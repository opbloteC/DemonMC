import { isEmailAddress, isMinecraftUsername, isStrongPassword } from "./validation";

export interface RegistrationFieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface RegistrationInput {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegistration(input: RegistrationInput): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  const username = input.username.trim();
  const email = input.email.trim();

  if (!username) {
    errors.username = "Minecraft username is required.";
  } else if (!isMinecraftUsername(username)) {
    errors.username = "Use 3–16 letters, numbers or underscores.";
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
  } else if (!isStrongPassword(input.password)) {
    errors.password = "Use 10–200 characters with at least one letter and one number.";
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = "Confirm password is required.";
  } else if (!input.confirmPassword.trim()) {
    errors.confirmPassword = "Confirm password cannot be only spaces.";
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
