import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const encryptionKeyPattern = /^[0-9a-fA-F]{64}$/;
const envelopeVersion = 'v1';
const initializationVectorBytes = 12;
const authenticationTagBytes = 16;
const additionalAuthenticatedData = Buffer.from('notification-settings:smtp-password:v1', 'utf8');

export class SecretBoxConfigurationError extends Error {
  constructor() {
    super('SETTINGS_ENCRYPTION_KEY 必须配置为 64 个十六进制字符。');
    this.name = 'SecretBoxConfigurationError';
  }
}

export class SecretBoxDecryptionError extends Error {
  constructor() {
    super('无法解密已保存的邮件服务密码，请检查配置加密密钥。');
    this.name = 'SecretBoxDecryptionError';
  }
}

export function isSecretBoxConfigured() {
  return encryptionKeyPattern.test(process.env.SETTINGS_ENCRYPTION_KEY || '');
}

export function encryptSecret(value: string) {
  if (!value) throw new Error('Cannot encrypt an empty secret.');

  const key = getEncryptionKey();
  const initializationVector = randomBytes(initializationVectorBytes);
  const cipher = createCipheriv('aes-256-gcm', key, initializationVector);
  cipher.setAAD(additionalAuthenticatedData);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [
    envelopeVersion,
    initializationVector.toString('base64url'),
    ciphertext.toString('base64url'),
    authenticationTag.toString('base64url')
  ].join('.');
}

export function decryptSecret(envelope: string) {
  const key = getEncryptionKey();
  const [version, encodedInitializationVector, encodedCiphertext, encodedAuthenticationTag, ...extraParts] =
    envelope.split('.');

  if (
    version !== envelopeVersion ||
    !isBase64Url(encodedInitializationVector) ||
    !isBase64Url(encodedCiphertext) ||
    !isBase64Url(encodedAuthenticationTag) ||
    extraParts.length > 0
  ) {
    throw new SecretBoxDecryptionError();
  }

  try {
    const initializationVector = Buffer.from(encodedInitializationVector, 'base64url');
    const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
    const authenticationTag = Buffer.from(encodedAuthenticationTag, 'base64url');
    if (
      initializationVector.length !== initializationVectorBytes ||
      ciphertext.length === 0 ||
      authenticationTag.length !== authenticationTagBytes
    ) {
      throw new SecretBoxDecryptionError();
    }

    const decipher = createDecipheriv('aes-256-gcm', key, initializationVector);
    decipher.setAAD(additionalAuthenticatedData);
    decipher.setAuthTag(authenticationTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof SecretBoxDecryptionError) throw error;
    throw new SecretBoxDecryptionError();
  }
}

function getEncryptionKey() {
  const encodedKey = process.env.SETTINGS_ENCRYPTION_KEY || '';
  if (!encryptionKeyPattern.test(encodedKey)) throw new SecretBoxConfigurationError();
  return Buffer.from(encodedKey, 'hex');
}

function isBase64Url(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value);
}
