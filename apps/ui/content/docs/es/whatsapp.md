# WhatsApp

La integración con WhatsApp permite enviar mensajes a pacientes directamente desde el sistema, incluyendo recetas, recordatorios y comunicaciones generales.

> Esta sección de configuración solo está disponible para **administradores** de la organización.

## Vincular WhatsApp

<!-- TODO: Agregar screenshot de la pantalla de vinculación de WhatsApp -->

### Proceso de vinculación

1. Ve a **Configuración > WhatsApp**
2. Se mostrará un **código QR**
3. Abre WhatsApp en tu teléfono
4. Ve a **Dispositivos vinculados** (en el menú de configuración de WhatsApp)
5. Escanea el código QR
6. La cuenta queda vinculada al sistema

### Estado de la conexión

El sistema muestra el estado actual de la conexión:

| Estado | Significado |
|--------|-------------|
| **Conectado** | WhatsApp está vinculado y funcionando |
| **Desconectado** | La sesión expiró o fue cerrada — es necesario volver a vincular |
| **Sin configurar** | No se ha vinculado ninguna cuenta |

## Uso de WhatsApp en el sistema

Una vez vinculado, WhatsApp se puede usar para:

- **Compartir recetas**: Desde la lista de recetas, enviar la receta al paciente
- **Comunicación general**: Enviar mensajes a pacientes desde su perfil

## Consideraciones

- Solo se puede vincular **una cuenta de WhatsApp** por organización
- La cuenta vinculada debe permanecer activa en el teléfono
- Si se cierra la sesión desde el teléfono, es necesario volver a escanear el código QR
- Los mensajes enviados aparecen como si fueran enviados desde la cuenta personal vinculada
