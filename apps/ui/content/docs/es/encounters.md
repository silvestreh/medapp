# Consultas

El módulo de consultas es el centro del sistema. Desde aquí gestionas los encuentros médicos con tus pacientes, accedes a su historial clínico y completas formularios médicos.

## Pantalla principal

La pantalla de consultas se divide en dos áreas:

- **Turnos de hoy** (columna izquierda): Muestra los turnos agendados para el día actual, organizados por horario.
- **Búsqueda de pacientes** (columna derecha): Permite buscar pacientes por nombre, apellido o documento para iniciar una consulta.

<!-- TODO: Agregar screenshot de la pantalla principal de consultas -->

## Buscar un paciente

Escribe el nombre, apellido o número de documento del paciente en la barra de búsqueda. Los resultados aparecen en tiempo real. Haz clic en un paciente para acceder a su historial.

## Historial del paciente

Al seleccionar un paciente, verás su historial organizado en un **árbol de encuentros** en la barra lateral izquierda. Los encuentros están ordenados por fecha, del más reciente al más antiguo.

<!-- TODO: Agregar screenshot del árbol de encuentros -->

### Navegación del historial

- Haz clic en una **fecha** para expandir los formularios de ese encuentro
- Haz clic en un **formulario específico** para ver su contenido
- Los **estudios** y **recetas** también aparecen en el árbol, integrados cronológicamente

### Acciones disponibles

En la barra superior encontrarás las acciones principales:

| Acción              | Descripción                                               |
| ------------------- | --------------------------------------------------------- |
| **Prescribir**      | Abre el modal para emitir una receta o una orden médica   |
| **Imprimir**        | Genera un PDF con el historial del paciente para imprimir |
| **Exportar**        | Exporta el historial como PDF firmado digitalmente        |
| **Asistente IA**    | Abre el chat con el asistente de inteligencia artificial  |
| **Nuevo encuentro** | Crea un nuevo encuentro para este paciente                |

## Nuevo encuentro

Al crear un nuevo encuentro:

1. Selecciona los **formularios** que necesitas desde la barra lateral (motivo de consulta, examen físico, diagnóstico, etc.)
2. Completa cada formulario con los datos del paciente
3. Opcionalmente, **adjunta archivos** (imágenes, PDFs, documentos) usando el botón de clip
4. Los cambios se guardan automáticamente

<!-- TODO: Agregar screenshot del formulario de nuevo encuentro -->

> Los formularios disponibles dependen de la configuración de tu organización. Si necesitas formularios adicionales, contacta al administrador.

## Adjuntos

Puedes adjuntar archivos a cualquier encuentro usando el botón de clip en la barra superior. Los formatos soportados incluyen imágenes (JPG, PNG), documentos PDF y otros archivos relevantes.

Los adjuntos aparecen en el árbol de encuentros y pueden visualizarse haciendo clic sobre ellos.
