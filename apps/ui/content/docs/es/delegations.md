# Delegaciones

El sistema de delegaciones permite a los médicos otorgar acceso a usuarios prescriptores para emitir recetas y órdenes médicas en su nombre.

## Qué es una delegación

Una delegación es una autorización que un **médico** otorga a un **prescriptor** para que este pueda:

- Emitir recetas a nombre del médico
- Emitir órdenes médicas a nombre del médico
- Ver las recetas emitidas por el médico
- Acceder a los códigos de práctica del médico

> Los prescriptores **no son médicos** — son profesionales de la salud (enfermeros, bioquímicos, etc.) que pueden emitir ciertos tipos de prescripciones bajo supervisión médica.

## Configurar delegaciones

La configuración de delegaciones se encuentra en **Configuración > Recetas**.

<!-- TODO: Agregar screenshot de la sección de delegaciones -->

### Vista del médico

Si eres médico, verás la lista de prescriptores a quienes les puedes delegar acceso:

1. Ve a **Configuración > Recetas**
2. En la sección de **delegaciones**, verás los usuarios con rol de prescriptor
3. Activa o desactiva la delegación para cada prescriptor con el switch correspondiente

### Vista del prescriptor

Si eres prescriptor, verás la lista de médicos que te delegaron acceso. No puedes modificar las delegaciones — solo el médico puede otorgar o revocar el acceso.

## Cómo funciona en la práctica

### Para el prescriptor

1. Ve a la sección de **Recetas**
2. En el selector de médico (barra superior), aparecen los médicos que te delegaron acceso
3. Selecciona el médico a nombre del cual quieres prescribir
4. Emite la receta normalmente — se firmará a nombre del médico seleccionado

<!-- TODO: Agregar screenshot del selector de médico mostrando médicos delegados -->

### Para el médico

Las recetas emitidas por prescriptores en tu nombre aparecen en tu lista de recetas. Puedes:

- Ver quién emitió cada receta
- Cancelar recetas si es necesario
- Revocar la delegación en cualquier momento

## Requisitos

Para que el sistema de delegaciones funcione correctamente:

| Requisito                                     | Quién                       |
| --------------------------------------------- | --------------------------- |
| Tener la integración con Recetario habilitada | Administrador               |
| Tener el rol de **médico**                    | El que delega               |
| Tener el rol de **prescriptor**               | El que recibe la delegación |
| Estar verificado (KYC aprobado)               | El médico                   |
| Tener firma digital configurada               | El médico                   |

## Preguntas frecuentes

**¿Un prescriptor puede delegar a otro prescriptor?**
No. Solo los médicos pueden crear delegaciones.

**¿Puedo delegar a alguien que no tiene rol de prescriptor?**
No. El usuario debe tener el rol de prescriptor asignado en la sección de Usuarios.

**¿Qué pasa si revoco una delegación?**
El prescriptor deja de ver al médico en su selector y no puede emitir más recetas a su nombre. Las recetas ya emitidas no se ven afectadas.

**¿Puede un prescriptor tener delegaciones de varios médicos?**
Sí. Un prescriptor puede recibir delegaciones de múltiples médicos y seleccionar a nombre de cuál quiere prescribir.
