# Facturación

El módulo de facturación permite controlar los ingresos por práctica médica, desglosados por obra social, y gestionar los costos de prácticas que no fueron facturadas automáticamente.

## Panel de facturación

<!-- TODO: Agregar screenshot del panel de facturación -->

### Selector de médico

En la barra superior, selecciona el médico cuya facturación quieres revisar.

### Filtros

- **Obra social**: Filtra por una obra social específica o muestra todas
- **Rango de fechas**: Selecciona el período de facturación (por defecto, últimos 30 días)

### Métricas

- **Total facturado**: Monto total en el período seleccionado
- **Gráfico por obra social**: Distribución visual de ingresos por obra social

### Tabla de prácticas

La tabla muestra cada práctica facturada con:

| Columna | Descripción |
|---------|-------------|
| **Fecha** | Fecha de la práctica |
| **Tipo** | Consulta o estudio |
| **Obra social** | Obra social del paciente |
| **Paciente** | Nombre del paciente |
| **Costo** | Monto facturado |

## Prácticas sin costos

Las prácticas que no tienen un precio asignado aparecen marcadas con la etiqueta **"sin costos"** en naranja. Esto ocurre cuando la obra social del paciente no tiene precios configurados para ese tipo de práctica.

<!-- TODO: Agregar screenshot mostrando prácticas sin costos -->

## Backfill (facturación retroactiva)

El backfill permite asignar costos masivamente a prácticas que no fueron facturadas:

1. Selecciona las prácticas sin costos usando los checkboxes
2. Haz clic en **"Facturar seleccionadas"**
3. El sistema calcula los costos según la configuración de precios vigente
4. Se muestra una notificación con el resultado y la opción de **deshacer**

> Si te equivocas, puedes deshacer el backfill inmediatamente desde la notificación.

## Configuración de precios

Accede a la configuración de precios desde el botón **"Configuración"** en la barra superior. Consulta la sección de **Prácticas** en esta documentación para más detalles.
