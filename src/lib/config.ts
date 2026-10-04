import "server-only";

/**
 * 部署期开关。放在环境变量里，改完重新部署即生效，不需要改代码。
 *
 * ALLOW_REGISTRATION
 *   未设置 / 任意非 "false" 值 -> 允许注册（默认，便于首次部署时能建号）
 *   "false" / "0" / "off" / "no" -> 关闭注册
 *
 * 关闭后：/register 不再提供注册表单，registerAction 服务端也会直接拒绝，
 * 登录页隐藏注册入口。已存在的账号照常登录，不受影响。
 */
const FALSY = new Set(["false", "0", "off", "no"]);

export function isRegistrationAllowed(): boolean {
  const raw = process.env.ALLOW_REGISTRATION?.trim().toLowerCase();
  if (!raw) return true;
  return !FALSY.has(raw);
}
