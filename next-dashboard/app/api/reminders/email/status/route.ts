import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/lib/admin-session';
import { createSmtpTransport, getSmtpConfig, getSmtpErrorMessage } from '@/lib/email-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasValidAdminSession(request))) {
    return json({ ok: false, code: 'ADMIN_SESSION_REQUIRED', message: '管理员会话已失效，请重新登录。' }, 401);
  }

  let smtpConfig: Awaited<ReturnType<typeof getSmtpConfig>>;
  try {
    smtpConfig = await getSmtpConfig();
  } catch (error) {
    console.error('Failed to load SMTP configuration.', getSafeError(error));
    return json({
      ok: false,
      code: 'EMAIL_SETTINGS_UNAVAILABLE',
      configured: false,
      verified: false,
      message: '暂时无法读取邮件投递配置。'
    }, 503);
  }
  if (!smtpConfig.ok) {
    return json({
      ok: true,
      configured: false,
      verified: false,
      message: smtpConfig.message
    });
  }

  const { host, port, secure, requireTls, from, replyTo, auth, testTo } = smtpConfig.value;
  const publicConfig = {
    host,
    port,
    secure,
    requireTls,
    from,
    replyTo: replyTo || null,
    authenticated: Boolean(auth),
    defaultTestRecipientConfigured: Boolean(testTo)
  };
  const transport = createSmtpTransport(smtpConfig.value);

  try {
    await transport.verify();
    return json({
      ok: true,
      configured: true,
      verified: true,
      message: 'SMTP 连接与认证验证通过。',
      checkedAt: new Date().toISOString(),
      ...publicConfig
    });
  } catch (error) {
    console.error('Failed to verify SMTP configuration.', getSmtpErrorMessage(error));
    return json({
      ok: true,
      configured: true,
      verified: false,
      message: getSmtpErrorMessage(error),
      checkedAt: new Date().toISOString(),
      ...publicConfig
    });
  } finally {
    transport.close();
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}

function getSafeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown email settings error';
}
