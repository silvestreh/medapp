# Verificación de Identidad (KYC)

La verificación de identidad es un paso obligatorio para los profesionales médicos antes de poder crear estudios, emitir recetas o exportar documentos firmados.

> Esta sección solo está disponible para usuarios con rol de **médico**.

## Por qué es necesaria

La verificación de identidad garantiza que el profesional que usa el sistema es quien dice ser. Esto es un requisito legal para la emisión de recetas digitales y la firma de documentos médicos.

## Proceso de verificación

<!-- TODO: Agregar screenshot de la pantalla de verificación de identidad -->

### Paso 1: Escaneo del DNI

1. Ve a **Configuración > Verificación de identidad**
2. El sistema te guiará para escanear tu DNI argentino
3. Se extraen automáticamente los datos del documento (nombre, apellido, fecha de nacimiento, género)

### Paso 2: Verificación automática

Una vez escaneado el DNI:

- El sistema realiza una **verificación automática** cruzando los datos del documento con los de tu perfil
- El estado cambia a **"pendiente"** mientras se procesa
- La verificación se actualiza automáticamente (no es necesario recargar la página)

### Paso 3: Resultado

| Estado        | Significado                                  |
| ------------- | -------------------------------------------- |
| **Pendiente** | La verificación está en proceso              |
| **Aprobado**  | La identidad fue verificada exitosamente     |
| **Rechazado** | La verificación falló (se muestra el motivo) |

## Si la verificación es rechazada

Si tu verificación fue rechazada, se mostrará el motivo del rechazo. Las causas más comunes son:

- Los datos del DNI no coinciden con los del perfil
- La imagen del DNI no es legible
- El documento está vencido

Para reintentar, corrige los datos en tu perfil y vuelve a iniciar el proceso.

## Datos que se verifican

El escaneo del DNI extrae y verifica:

- Nombre y apellido
- Fecha de nacimiento
- Género
- Número de documento

> Estos datos se sincronizan automáticamente con tu perfil si la verificación es exitosa.

## Impacto en el sistema

Mientras tu identidad **no esté verificada**:

- No podrás crear nuevos estudios
- No podrás emitir recetas ni órdenes
- No podrás exportar PDFs firmados
- Se mostrará un banner de advertencia en la parte superior de la pantalla

<!-- TODO: Agregar screenshot del banner de verificación pendiente -->
