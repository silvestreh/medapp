# Firma Digital

La firma digital permite firmar electrónicamente los documentos generados por el sistema, como exportaciones de historiales clínicos en PDF.

> Esta sección solo está disponible para usuarios con rol de **médico**.

## Certificado de firma

Para firmar documentos digitalmente, es necesario cargar un certificado de firma digital emitido por una autoridad certificante reconocida.

<!-- TODO: Agregar screenshot de la sección de firma digital -->

### Subir un certificado

1. Ve a **Configuración > Firma**
2. Haz clic en **"Subir certificado"**
3. Selecciona el archivo del certificado (formato `.pfx` o `.p12`)
4. Ingresa la **contraseña del certificado** si tiene una
5. El sistema valida y almacena el certificado de forma segura

### Estado del certificado

El sistema muestra el estado actual del certificado:

| Estado | Descripción |
|--------|-------------|
| **Sin certificado** | No se ha cargado ningún certificado |
| **Válido** | El certificado está cargado y vigente |
| **Encriptado** | El certificado requiere contraseña para cada firma |

### Eliminar un certificado

Para reemplazar o eliminar un certificado existente, usa el botón correspondiente en la sección de firma.

## Uso de la firma

Una vez configurado el certificado, la firma digital se usa al:

- **Exportar PDF firmado**: Desde el historial de un paciente, el botón "Exportar" genera un PDF con firma digital
- **Recetas**: Las recetas emitidas a través de Recetario incluyen la firma del profesional

> Si el certificado está encriptado, el sistema solicitará la contraseña cada vez que se necesite firmar un documento.
