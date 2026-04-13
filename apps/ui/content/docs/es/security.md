# Seguridad

La sección de seguridad permite proteger tu cuenta con autenticación de dos factores (2FA), passkeys y gestión de contraseña.

## Cambiar contraseña

1. Ingresa tu **contraseña actual**
2. Escribe la **nueva contraseña**
3. Confirma la nueva contraseña
4. Haz clic en **"Guardar"**

La contraseña debe cumplir con los siguientes requisitos:

- Al menos 8 caracteres
- Una letra mayúscula
- Una letra minúscula
- Un número
- Un carácter especial (!@#$...)

> Si tu contraseña actual no cumple con la política de seguridad, el sistema mostrará un banner de advertencia al iniciar sesión.

## Autenticación de dos factores (2FA)

La autenticación de dos factores agrega una capa extra de seguridad a tu cuenta. Al activarla, además de tu contraseña necesitarás un código temporal generado por una aplicación de autenticación.

<!-- TODO: Agregar screenshot del QR de configuración de 2FA -->

### Activar 2FA

1. Ve a **Configuración > Seguridad**
2. Haz clic en **"Activar 2FA"**
3. Escanea el **código QR** con una aplicación de autenticación (Google Authenticator, Authy, 1Password, etc.)
4. Ingresa el **código de 6 dígitos** que muestra la aplicación para confirmar
5. La 2FA queda activada

### Desactivar 2FA

1. Haz clic en **"Desactivar 2FA"**
2. Ingresa tu contraseña para confirmar

> Se recomienda mantener la 2FA activada para proteger la información médica de tus pacientes.

## Passkeys

Las passkeys permiten iniciar sesión sin contraseña, usando la autenticación biométrica de tu dispositivo (huella digital, reconocimiento facial) o una llave de seguridad física.

<!-- TODO: Agregar screenshot de la sección de passkeys -->

### Registrar una passkey

1. Ve a **Configuración > Seguridad**
2. En la sección de passkeys, haz clic en **"Registrar passkey"**
3. Sigue las instrucciones del navegador para crear la passkey
4. La passkey queda registrada y podrás usarla para iniciar sesión

### Eliminar una passkey

En la lista de passkeys registradas, haz clic en el botón de eliminar junto a la passkey que deseas remover.

### Ventajas de las passkeys

| Característica               | Contraseña | Passkey |
| ---------------------------- | ---------- | ------- |
| **Resistente a phishing**    | No         | Sí      |
| **Requiere memorización**    | Sí         | No      |
| **Vinculada al dispositivo** | No         | Sí      |
| **Compatible con biometría** | No         | Sí      |

> Las passkeys son el método de autenticación más seguro disponible. Se recomienda registrar al menos una como respaldo.
