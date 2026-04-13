# Recetas y Órdenes

El módulo de recetas permite emitir prescripciones médicas y órdenes a través de la integración con **Recetario**, la plataforma argentina de recetas digitales.

## Integración con Recetario

Athelas se integra con Recetario para:

- Buscar medicamentos en la base de datos oficial
- Emitir recetas digitales firmadas
- Emitir órdenes médicas
- Compartir recetas con pacientes por WhatsApp o email
- Cancelar recetas emitidas

> Para usar recetas, un administrador debe habilitar la integración con Recetario desde **Configuración > Recetas**. Esto requiere que la organización tenga dirección, teléfono, email y logo configurados.

## Pantalla principal

<!-- TODO: Agregar screenshot de la lista de recetas -->

La pantalla de recetas muestra:

- **Selector de médico**: Elige el médico cuyas recetas quieres ver (los prescriptores ven los médicos que les delegaron acceso)
- **Filtro de tipo**: Alterna entre recetas, órdenes o todas
- **Búsqueda de paciente**: Filtra recetas por paciente específico
- **Tabla de recetas**: Lista con fecha, paciente, tipo, estado, medicamentos y acciones

### Estados de una receta

| Estado         | Significado                          |
| -------------- | ------------------------------------ |
| **Pendiente**  | La receta fue emitida y está vigente |
| **Completada** | La receta fue dispensada             |
| **Cancelada**  | La receta fue anulada                |

## Emitir una receta

1. Haz clic en **"Nueva receta"**
2. Selecciona el **paciente** (se busca automáticamente en Recetario)
3. Agrega el **diagnóstico** (búsqueda por código CIE-10)
4. Agrega los **medicamentos** (búsqueda en la base de datos de Recetario)
5. Selecciona la **obra social** y el **consultorio**
6. Confirma la emisión

<!-- TODO: Agregar screenshot del modal de nueva receta -->

## Emitir una orden médica

El flujo es similar al de una receta, pero en lugar de medicamentos se indica el tipo de estudio o práctica a realizar.

## Repetir una receta

Para repetir una receta anterior:

1. Busca la receta en la lista
2. Haz clic en el botón **"Repetir"**
3. Confirma la acción
4. Se crea una nueva receta con los mismos datos

## Compartir una receta

Las recetas emitidas pueden compartirse con el paciente vía WhatsApp o email directamente desde la tabla de recetas.

## Acceso para prescriptores

Los prescriptores (no médicos) solo pueden emitir recetas en nombre de médicos que les hayan delegado acceso. Consulta la sección de **Delegaciones** para más información.
