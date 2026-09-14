export function authErrorMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Неверный email или пароль.";
  if (m.includes("already registered"))
    return "Пользователь с таким email уже зарегистрирован.";
  if (m.includes("password should be at least"))
    return "Пароль должен быть не короче 6 символов.";
  if (m.includes("email not confirmed"))
    return "Email не подтверждён — проверьте почту и перейдите по ссылке.";
  if (m.includes("rate limit"))
    return "Слишком много попыток. Подождите немного и повторите.";
  if (m.includes("network") || m.includes("fetch"))
    return "Ошибка сети. Проверьте подключение и переменные окружения.";
  return msg;
}
