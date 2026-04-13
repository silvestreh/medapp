# Usuarios y Roles

El módulo de usuarios permite gestionar los miembros de tu organización, asignarles roles y controlar sus permisos.

## Lista de usuarios

La pantalla muestra una tabla con todos los miembros de la organización:

<!-- TODO: Agregar screenshot de la lista de usuarios -->

| Columna      | Descripción         |
| ------------ | ------------------- |
| **Usuario**  | Nombre de usuario   |
| **Nombre**   | Nombre completo     |
| **Email**    | Dirección de correo |
| **Roles**    | Roles asignados     |
| **Acciones** | Eliminar miembro    |

## Invitar usuarios

1. Haz clic en **"Invitar usuario"** en la barra superior
2. Ingresa el **email** del usuario a invitar
3. Selecciona el **rol** inicial
4. Haz clic en **"Enviar invitación"**

El usuario recibirá un email con un enlace para unirse a la organización.

## Roles disponibles

| Rol                       | Permisos                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Administrador (owner)** | Acceso total: configuración de organización, usuarios, WhatsApp, asistente IA       |
| **Médico**                | Consultas, estudios, recetas, facturación, firma digital, verificación de identidad |
| **Prescriptor**           | Emitir recetas en nombre de médicos delegados, gestionar prácticas delegadas        |
| **Recepcionista**         | Gestión de pacientes y turnos                                                       |

## Cambiar roles

Para cambiar los roles de un usuario:

1. Busca el usuario en la tabla
2. Haz clic en el selector de roles en su fila
3. Agrega o quita roles según sea necesario

> El rol **Administrador** no puede modificarse desde esta interfaz por seguridad.

## Eliminar un usuario

1. Haz clic en el botón de eliminar (X) en la fila del usuario
2. Confirma la acción en el diálogo de confirmación

> No puedes eliminarte a ti mismo ni eliminar al administrador de la organización.
