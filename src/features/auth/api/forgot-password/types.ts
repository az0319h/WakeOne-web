export type ForgotPasswordRequestPayload = {
  email: string;
};

export type ForgotPasswordVerifyPayload = {
  email: string;
  token: string;
};

export type ForgotPasswordResponse = {
  success: boolean;
  message: string;
};
