-- Cuentas institucionales: solo el administrador crea usuarios; ingreso con contraseña + código por correo,
-- dispositivos de confianza, passkeys (WebAuthn) y bloqueo progresivo.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status STRING NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  ADD COLUMN IF NOT EXISTS must_change_password BOOL NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS failed_logins INT NOT NULL DEFAULT 0 CHECK (failed_logins >= 0),
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;

-- Cada refresh pertenece a una familia (un inicio de sesión). Reusar un token ya rotado revoca a toda la familia del usuario.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_id UUID NULL,
  ADD COLUMN IF NOT EXISTS auth_method STRING NULL CHECK (auth_method IS NULL OR auth_method IN ('password', 'otp', 'trusted_device', 'passkey', 'facial')),
  ADD COLUMN IF NOT EXISTS user_agent STRING NULL,
  ADD COLUMN IF NOT EXISTS ip STRING NULL,
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens (family_id);

-- Código de 6 dígitos: solo se guarda su hash; vence a los 10 minutos, 5 intentos, un solo uso.
CREATE TABLE IF NOT EXISTS login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash STRING NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  ip STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_challenges_user ON login_challenges (user_id, created_at DESC);

-- "Recordar este dispositivo" por 30 días: cookie HttpOnly con un token aleatorio; aquí solo el hash.
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash STRING NOT NULL UNIQUE,
  label STRING NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices (user_id);

-- Passkeys: Touch ID, Face ID, huella de Android o Windows Hello. La biometría nunca sale del dispositivo.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  credential_id STRING NOT NULL UNIQUE,
  public_key BYTES NOT NULL,
  counter INT8 NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports STRING NULL,
  device_type STRING NULL,
  backed_up BOOL NOT NULL DEFAULT false,
  label STRING NOT NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials (user_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge STRING NOT NULL,
  kind STRING NOT NULL CHECK (kind IN ('register', 'login')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auditoría de cada carga masiva (usuarios o estructura académica).
CREATE TABLE IF NOT EXISTS account_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  kind STRING NOT NULL CHECK (kind IN ('users', 'structure')),
  file_name STRING NOT NULL,
  total_rows INT NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  created_count INT NOT NULL DEFAULT 0 CHECK (created_count >= 0),
  skipped_count INT NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  errors JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_imports_created ON account_imports (created_at DESC);
