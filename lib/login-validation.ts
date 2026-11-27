import { isEmailAddress } from "./validation";

export interface LoginFieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

export interface LoginInput {
  username: string;
  email: string;
  password: string;
}

export function validateLogin(input: LoginInput): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const username = input.username.trim();
  const email = input.email.trim();

  if (!username) {
    errors.username = "Minecraft username is required.";
  } else if (username.length > 254) {
    errors.username = "Minecraft username is too long.";
  }

  if (!email) {
    errors.email = "Email address is required.";
  } else if (!isEmailAddress(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!input.password) {
    errors.password = "Password is required.";
  } else if (!input.password.trim()) {
    errors.password = "Password cannot be only spaces.";
  } else if (input.password.length > 200) {
    errors.password = "Use a password of 200 characters or fewer.";
  }

  return errors;
}
