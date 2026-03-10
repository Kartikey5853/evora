from schema.base import BaseSchema


class UserRegister(BaseSchema):
    name: str
    email: str
    password: str


class UserLogin(BaseSchema):
    email: str
    password: str


class AdminRegister(BaseSchema):
    name: str
    email: str
    password: str


class AdminLogin(BaseSchema):
    email: str
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"


class OTPRequest(BaseSchema):
    email: str
    password: str


class OTPVerify(BaseSchema):
    email: str
    otp: str


class RegisterStart(BaseSchema):
    name: str
    email: str
    password: str


class ResetStart(BaseSchema):
    email: str


class ResetComplete(BaseSchema):
    email: str
    otp: str
    new_password: str


class GoogleTokenLogin(BaseSchema):
    credential: str  # Google ID token from frontend
    role: str = "user"  # user | admin
