# Prácticas y Precios

La sección de prácticas permite configurar los consultorios, los códigos de práctica médica por obra social y los precios de facturación.

## Consultorios

<!-- TODO: Agregar screenshot de la lista de consultorios -->

### Crear un consultorio

1. Ve a **Configuración > Prácticas**
2. Haz clic en **"Nuevo consultorio"**
3. Completa los datos: nombre, dirección, teléfono
4. Guarda el registro

Los consultorios aparecen como opciones al emitir recetas y se usan para asociar la práctica médica a un lugar de atención.

## Configuración de precios por obra social

La configuración de precios se encuentra en la sección de **Facturación > Configuración**. Desde allí puedes:

### Agregar obras sociales

1. Haz clic en **"Agregar obra social"** en la barra lateral
2. Busca la obra social por nombre
3. Se agrega a tu lista de configuración

También puedes importar automáticamente obras sociales de prácticas anteriores con el botón **"Agregar pasadas"**.

### Configurar precios

Para cada obra social puedes configurar:

<!-- TODO: Agregar screenshot del formulario de precios -->

| Campo                  | Descripción                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| **Tipo de precio**     | Precio fijo (monto en $) o multiplicador (unidades x valor base) |
| **Código de práctica** | Código médico usado para la facturación                          |
| **Precio normal**      | Precio para atención en horario normal                           |
| **Precio de guardia**  | Precio para atención en guardia                                  |
| **Costos extra**       | Costos adicionales por sección de estudio (hemoglobina, etc.)    |

### Modo de precios

Alterna entre **Normal** y **Guardia** usando el selector en la parte superior del formulario para configurar precios diferenciados según el tipo de atención.

### Valor base (multiplicador)

Cuando el tipo de precio es **Multiplicador**:

- Define un **nombre base** (ej: "UHB") y un **valor base** en pesos
- Cada práctica se configura con una cantidad de unidades
- El precio final = unidades x valor base

### Copiar configuración

Para copiar la configuración de precios de una obra social a otra:

1. Selecciona la obra social destino
2. Usa el selector **"Copiar de..."** en la barra superior
3. Selecciona la obra social origen
4. Los precios se copian automáticamente

### Ocultar obras sociales

Puedes ocultar obras sociales que ya no uses sin eliminar su configuración. Usa el switch **"Visible"** en el encabezado de cada obra social.

## Backfill de costos

La sección de backfill permite facturar retroactivamente prácticas que no tenían precios asignados. Consulta la documentación de **Facturación** para más detalles.

## Acceso para prescriptores

Los prescriptores pueden ver las prácticas de los médicos que les delegaron acceso, pero no pueden modificar la configuración de precios.
