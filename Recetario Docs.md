# Botón embebible (Quick links)
---
# Primeros pasos

## Introducción
El botón embebible es la forma más rápida de integrar tu sistema a Recetario. Sólo tenés que agregar un botón en tu frontend que
- abra una nueva ventana o pestaña en el navegador
- o muestre un iframe

## Autenticación
El endpoint para generar los links requiere autenticación, para lo cual debe enviarse el siguiente header:

`Authorization: Bearer <JWT>`

donde el jwt será entregado por nuestro equipo.

:::highlight orange 💡
Nunca expongas las credenciales en un repositorio público, ni las utilices en tu código client-side. Siempre hacelo de manera segura desde tu servidor.
:::

Si aún no tenés las credenciales, [contactate con nostoros](mailto:institucional@recetario.com.ar).

## Entornos
:::highlight red 📌
Información importante
:::
Actualmente los entornos de **staging** y **producción** se encuentran unificados. La única distinción entre ellos es el usuario que prescribe:
- si el mail del usuario es @recetario.com.ar, el entorno es **staging**
- caso contrario, es **producción**.

Próximamente serán entornos aislados.

# Detalle de flujo

## Generación de quick-links
Para generar los links sólo tenés que hacer una [request](/api-7413386) desde el back-end de tu aplicación.
A continuación vas a encontrar un diagrama de flujo detallando el proceso completo:

![quickLinksFlowDiagram.jpg](https://api.apidog.com/api/v1/projects/520999/resources/341183/image-preview)

## Recuperación de prescripciones
Al finalizar el flujo de prescripción desde el botón embebible, se emiten una o varias prescripciones. En caso de querer obtener la información de dichas prescripciones, existen dos formas de hacerlo:
- consultar recurrentemente el GET de prescripciones por `reference` u otro identificador
- suscribirte al [webhook](/doc-1867790) de prescripciones generadas

Esto puede ser útil si por ejemplo querés mostrar en tu aplicación las prescripciones que se generaron en este flujo.

# Quick links

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /quick-links:
    post:
      summary: Quick links
      deprecated: false
      description: >-
        Genera links para emitir recetas y  órdenes, especificando el médico y
        el paciente.

        Ambos links tienen una validez de 20 minutos.


        La combinación email + tipo de licencia + número de licencia debe ser
        única (de lo contrario, devuelve un 409).


        Además, en el caso en que un profesional prescriba en más de un centro
        (`healthCenterId`) y considerando que el email del mismo debe ser único,
        sugerimos concatener un `+{healthCenterId}` adelante del `@`. Por
        ejemplo: `juanperez+1@gmail.com`
      operationId: quickLinks
      tags:
        - Botón embebible (Quick links)
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                doctor:
                  $ref: '#/components/schemas/doctor'
                patient:
                  $ref: '#/components/schemas/patient'
                reference:
                  type: string
                  description: Referencia externa que permite identificar recetas/órdenes
              x-apidog-orders:
                - doctor
                - patient
                - reference
              required:
                - doctor
                - patient
              x-apidog-ignore-properties: []
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  prescriptionsLink:
                    type: string
                    description: URL para emitir recetas al paciente especificado
                  ordersLink:
                    type: string
                    description: URL para emitir órdenes al paciente especificado
                x-apidog-orders:
                  - prescriptionsLink
                  - ordersLink
                required:
                  - prescriptionsLink
                  - ordersLink
                x-apidog-ignore-properties: []
          headers: {}
          x-apidog-name: Success
      security:
        - bearer: []
      x-apidog-folder: Botón embebible (Quick links)
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-7413386-run
components:
  schemas:
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - gender
        - birthDate
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes:
    bearer:
      type: http
      scheme: bearer
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# API
---

# Primeros pasos

## Autenticación
Todos los endpoints requieren autenticación, para lo cual debe enviarse el siguiente header:

`Authorization: Bearer <JWT>`

donde el jwt será entregado por nuestro equipo.

:::highlight orange 💡
Nunca expongas las credenciales en un repositorio público, ni las utilices en tu código client-side. Siempre hacelo de manera segura desde tu servidor.
:::

Si aún no tenés las credenciales, [contactate con nostoros](mailto:institucional@recetario.com.ar).



## Entornos
:::highlight red 📌
Información importante
:::
Actualmente los entornos de **staging** y **producción** se encuentran unificados. La única distinción entre ellos es el usuario que prescribe:
- si el mail del usuario es @recetario.com.ar, el entorno es **staging**
- caso contrario, es **producción**.

Próximamente serán entornos aislados.

# Nueva institución

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /health-centers:
    post:
      summary: Nueva institución
      deprecated: false
      description: ''
      operationId: createHealthCenter
      tags:
        - API/Instituciones
      parameters: []
      requestBody:
        content:
          application/json:
            schema: &ref_7
              $ref: '#/components/schemas/createHealthCenter'
            example: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/healthCenter'
          headers: {}
          x-apidog-name: Health center registered successfully
      security: []
      x-apidog-folder: API/Instituciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935235-run
components:
  schemas:
    createHealthCenter:
      type: object
      properties:
        name: &ref_0
          type: string
        address: &ref_1
          type: string
          description: Dirección
        phone: &ref_2
          type: string
          description: Teléfono
        email: &ref_3
          type: string
          format: email
          description: Email
        logoUrl: &ref_4
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_5
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_6
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: *ref_0
        address: *ref_1
        phone: *ref_2
        email: *ref_3
        logoUrl: *ref_4
        footer: *ref_5
        pdfVersion: *ref_6
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX: *ref_7
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# Obtención de instituciones

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /health-centers:
    get:
      summary: Obtención de instituciones
      deprecated: false
      description: Devuelve la informacion de las instituciones
      operationId: getHealthCenters
      tags:
        - API/Instituciones
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  description: Lista de instituciones
                  type: object
                  x-apidog-refs:
                    01J47THABKG0H8WH65MACQ3JVM: &ref_17
                      $ref: '#/components/schemas/healthCenter'
                      x-apidog-overrides: {}
                  properties:
                    id:
                      type: integer
                      format: int64
                    name:
                      type: string
                    address:
                      type: string
                      description: Dirección
                    phone:
                      type: string
                      description: Teléfono
                    email:
                      type: string
                      format: email
                      description: Email
                    logoUrl:
                      type: string
                      description: URL del logo con un máximo de 250px
                    footer:
                      type: string
                      description: >-
                        HTML custom que se ubica al final de las recetas y
                        órdenes. Reemplaza a la fila que contiene la dirección,
                        teléfono y mail.
                    pdfVersion:
                      type: number
                      description: Plantilla para emitir prescripciones y órdenes
                      default: 1
                      minimum: 1
                      maximum: 2
                    users:
                      type: array
                      items:
                        $ref: '#/components/schemas/user'
                  required:
                    - id
                    - name
                    - address
                    - phone
                    - email
                    - logoUrl
                    - users
                  x-apidog-orders:
                    - 01J47THABKG0H8WH65MACQ3JVM
                    - users
                  x-apidog-ignore-properties:
                    - id
                    - name
                    - address
                    - phone
                    - email
                    - logoUrl
                    - footer
                    - pdfVersion
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Instituciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-9035276-run
components:
  schemas:
    user:
      type: object
      properties:
        id:
          type: integer
          format: int64
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        email: &ref_1
          type: string
          format: email
          description: Email del usuario asociado
        name: &ref_2
          type: string
          description: Nombre del médico
        surname: &ref_3
          type: string
          description: Apellido del médico
        licenseType: &ref_4
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber: &ref_5
          type: string
          description: Número de licencia
        documentNumber: &ref_6
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title: &ref_7
          type: string
          description: '"Dr" o "Dra"'
        specialty: &ref_8
          type: string
          description: Especialidad
        workPhone: &ref_9
          type: string
          description: Número de teléfono del consultorio
        address: &ref_10
          type: string
          description: Dirección del consultorio
        province: &ref_11
          type: string
          description: Name del endpoint /provinces
        profile: &ref_0
          $ref: '#/components/schemas/profile'
        active:
          type: boolean
          description: >-
            Si el usuario está activo o no. Es necesario que lo esté para poder
            hacer requests en su nombre
      x-apidog-orders:
        - id
        - createdDate
        - 01HX30S0CXHW54JNQKXPAVQ6AV
        - active
      required:
        - id
        - createdDate
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
        - active
      x-apidog-refs:
        01HX30S0CXHW54JNQKXPAVQ6AV:
          $ref: '#/components/schemas/createUser'
          x-apidog-overrides:
            profile: *ref_0
          required:
            - profile
      x-apidog-ignore-properties:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email: *ref_1
        name: *ref_2
        surname: *ref_3
        licenseType: *ref_4
        licenseNumber: *ref_5
        documentNumber: *ref_6
        title: *ref_7
        specialty: *ref_8
        workPhone: *ref_9
        address: *ref_10
        province: *ref_11
        profile: &ref_12
          $ref: '#/components/schemas/createProfile'
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend: &ref_13
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone: &ref_14
          type: string
          description: Teléfono que se muestra en el PDF
        address: &ref_15
          type: string
          description: Dirección que se muestra en el PDF
        email: &ref_16
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4: *ref_12
      properties:
        id:
          type: integer
          format: int64
        legend: *ref_13
        phone: *ref_14
        address: *ref_15
        email: *ref_16
        healthCenter: *ref_17
      required:
        - id
        - legend
        - phone
        - address
        - email
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-ignore-properties:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: &ref_18
          type: string
        address: &ref_19
          type: string
          description: Dirección
        phone: &ref_20
          type: string
          description: Teléfono
        email: &ref_21
          type: string
          format: email
          description: Email
        logoUrl: &ref_22
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_23
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_24
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name: *ref_18
        address: *ref_19
        phone: *ref_20
        email: *ref_21
        logoUrl: *ref_22
        footer: *ref_23
        pdfVersion: *ref_24
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# Obtención de instituciones

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /health-centers:
    get:
      summary: Obtención de instituciones
      deprecated: false
      description: Devuelve la informacion de las instituciones
      operationId: getHealthCenters
      tags:
        - API/Instituciones
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  description: Lista de instituciones
                  type: object
                  x-apidog-refs:
                    01J47THABKG0H8WH65MACQ3JVM: &ref_17
                      $ref: '#/components/schemas/healthCenter'
                      x-apidog-overrides: {}
                  properties:
                    id:
                      type: integer
                      format: int64
                    name:
                      type: string
                    address:
                      type: string
                      description: Dirección
                    phone:
                      type: string
                      description: Teléfono
                    email:
                      type: string
                      format: email
                      description: Email
                    logoUrl:
                      type: string
                      description: URL del logo con un máximo de 250px
                    footer:
                      type: string
                      description: >-
                        HTML custom que se ubica al final de las recetas y
                        órdenes. Reemplaza a la fila que contiene la dirección,
                        teléfono y mail.
                    pdfVersion:
                      type: number
                      description: Plantilla para emitir prescripciones y órdenes
                      default: 1
                      minimum: 1
                      maximum: 2
                    users:
                      type: array
                      items:
                        $ref: '#/components/schemas/user'
                  required:
                    - id
                    - name
                    - address
                    - phone
                    - email
                    - logoUrl
                    - users
                  x-apidog-orders:
                    - 01J47THABKG0H8WH65MACQ3JVM
                    - users
                  x-apidog-ignore-properties:
                    - id
                    - name
                    - address
                    - phone
                    - email
                    - logoUrl
                    - footer
                    - pdfVersion
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Instituciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-9035276-run
components:
  schemas:
    user:
      type: object
      properties:
        id:
          type: integer
          format: int64
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        email: &ref_1
          type: string
          format: email
          description: Email del usuario asociado
        name: &ref_2
          type: string
          description: Nombre del médico
        surname: &ref_3
          type: string
          description: Apellido del médico
        licenseType: &ref_4
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber: &ref_5
          type: string
          description: Número de licencia
        documentNumber: &ref_6
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title: &ref_7
          type: string
          description: '"Dr" o "Dra"'
        specialty: &ref_8
          type: string
          description: Especialidad
        workPhone: &ref_9
          type: string
          description: Número de teléfono del consultorio
        address: &ref_10
          type: string
          description: Dirección del consultorio
        province: &ref_11
          type: string
          description: Name del endpoint /provinces
        profile: &ref_0
          $ref: '#/components/schemas/profile'
        active:
          type: boolean
          description: >-
            Si el usuario está activo o no. Es necesario que lo esté para poder
            hacer requests en su nombre
      x-apidog-orders:
        - id
        - createdDate
        - 01HX30S0CXHW54JNQKXPAVQ6AV
        - active
      required:
        - id
        - createdDate
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
        - active
      x-apidog-refs:
        01HX30S0CXHW54JNQKXPAVQ6AV:
          $ref: '#/components/schemas/createUser'
          x-apidog-overrides:
            profile: *ref_0
          required:
            - profile
      x-apidog-ignore-properties:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email: *ref_1
        name: *ref_2
        surname: *ref_3
        licenseType: *ref_4
        licenseNumber: *ref_5
        documentNumber: *ref_6
        title: *ref_7
        specialty: *ref_8
        workPhone: *ref_9
        address: *ref_10
        province: *ref_11
        profile: &ref_12
          $ref: '#/components/schemas/createProfile'
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend: &ref_13
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone: &ref_14
          type: string
          description: Teléfono que se muestra en el PDF
        address: &ref_15
          type: string
          description: Dirección que se muestra en el PDF
        email: &ref_16
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4: *ref_12
      properties:
        id:
          type: integer
          format: int64
        legend: *ref_13
        phone: *ref_14
        address: *ref_15
        email: *ref_16
        healthCenter: *ref_17
      required:
        - id
        - legend
        - phone
        - address
        - email
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-ignore-properties:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: &ref_18
          type: string
        address: &ref_19
          type: string
          description: Dirección
        phone: &ref_20
          type: string
          description: Teléfono
        email: &ref_21
          type: string
          format: email
          description: Email
        logoUrl: &ref_22
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_23
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_24
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name: *ref_18
        address: *ref_19
        phone: *ref_20
        email: *ref_21
        logoUrl: *ref_22
        footer: *ref_23
        pdfVersion: *ref_24
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# Actualizar institución

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /health-centers/{id}:
    put:
      summary: Actualizar institución
      deprecated: false
      description: Actualizar  los datos de la institución especificada por id
      operationId: putHealthCenter
      tags:
        - API/Instituciones
      parameters:
        - name: id
          in: path
          description: Id de la institución a modificar
          required: true
          schema:
            type: integer
      requestBody:
        content:
          application/json:
            schema: &ref_7
              $ref: '#/components/schemas/createHealthCenter'
            example: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/healthCenter'
          headers: {}
          x-apidog-name: Health center registered successfully
      security: []
      x-apidog-folder: API/Instituciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-9035604-run
components:
  schemas:
    createHealthCenter:
      type: object
      properties:
        name: &ref_0
          type: string
        address: &ref_1
          type: string
          description: Dirección
        phone: &ref_2
          type: string
          description: Teléfono
        email: &ref_3
          type: string
          format: email
          description: Email
        logoUrl: &ref_4
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_5
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_6
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: *ref_0
        address: *ref_1
        phone: *ref_2
        email: *ref_3
        logoUrl: *ref_4
        footer: *ref_5
        pdfVersion: *ref_6
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX: *ref_7
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# Nuevo usuario

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /users:
    post:
      summary: Nuevo usuario
      deprecated: false
      description: >-
        Crea un usuario.

        Los usuarios representan médicos, con toda su información. Son
        utilizados en el alta de recetas y órdenes.

        Por defecto no están activos. Para poder emitir recetas, es necesario
        activarlos usando la siguiente
        [request](https://docs.recetario.com.ar/api-6935234).


        Este endpoint es usado en caso de necesitar crear médicos
        programáticamente, caso contrario se usa el frontend
        (https://app.recetario.com.ar/register). En el caso de los médicos
        institucionales, se puede generar un link específico para la institución
        (https://app.recetario.com.ar/register?healthCenterId=:id)
      operationId: createUser
      tags:
        - API/Usuarios
      parameters: []
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                doctorWithLicense:
                  type: string
                  format: binary
                  description: >-
                    Archivo de la selfie con la matrícula. En caso de no
                    utilizarlo, mandar el campo sin valor
                  example: ''
                license:
                  type: string
                  format: binary
                  description: >-
                    Archivo de la foto de la matrícula. En caso de no
                    utilizarlo, mandar el campo sin valor
                  example: ''
                signature:
                  type: string
                  format: binary
                  description: Archivo de la firma
                  example: ''
                province:
                  type: string
                  description: Name del endpoint /provinces
                  example: ''
                address:
                  type: string
                  example: ''
                workPhone:
                  type: string
                  example: ''
                specialty:
                  type: string
                  example: ''
                title:
                  type: string
                  enum:
                    - Dr
                    - Dra
                  example: ''
                licenseNumber:
                  type: integer
                  example: 0
                licenseType:
                  type: string
                  enum:
                    - nacional
                    - provincial
                  example: ''
                documentNumber:
                  type: integer
                  description: >-
                    Número de documento, sin espacios, puntos o guiones con al
                    menos 6 dígitos
                  example: 0
                surname:
                  type: string
                  example: ''
                name:
                  type: string
                  example: ''
                password:
                  type: string
                  example: ''
                email:
                  type: string
                  format: email
                  example: ''
                healthCenterId:
                  type: integer
                  description: >-
                    Id de la institución asociada, en caso de querer asociarlo a
                    una institución
                  example: 0
                  nullable: true
              required:
                - province
                - address
                - workPhone
                - specialty
                - title
                - licenseNumber
                - licenseType
                - documentNumber
                - surname
                - name
                - password
                - email
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/user'
          headers: {}
          x-apidog-name: User created successfully
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935231-run
components:
  schemas:
    user:
      type: object
      properties:
        id:
          type: integer
          format: int64
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        email: &ref_1
          type: string
          format: email
          description: Email del usuario asociado
        name: &ref_2
          type: string
          description: Nombre del médico
        surname: &ref_3
          type: string
          description: Apellido del médico
        licenseType: &ref_4
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber: &ref_5
          type: string
          description: Número de licencia
        documentNumber: &ref_6
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title: &ref_7
          type: string
          description: '"Dr" o "Dra"'
        specialty: &ref_8
          type: string
          description: Especialidad
        workPhone: &ref_9
          type: string
          description: Número de teléfono del consultorio
        address: &ref_10
          type: string
          description: Dirección del consultorio
        province: &ref_11
          type: string
          description: Name del endpoint /provinces
        profile: &ref_0
          $ref: '#/components/schemas/profile'
        active:
          type: boolean
          description: >-
            Si el usuario está activo o no. Es necesario que lo esté para poder
            hacer requests en su nombre
      x-apidog-orders:
        - id
        - createdDate
        - 01HX30S0CXHW54JNQKXPAVQ6AV
        - active
      required:
        - id
        - createdDate
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
        - active
      x-apidog-refs:
        01HX30S0CXHW54JNQKXPAVQ6AV:
          $ref: '#/components/schemas/createUser'
          x-apidog-overrides:
            profile: *ref_0
          required:
            - profile
      x-apidog-ignore-properties:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email: *ref_1
        name: *ref_2
        surname: *ref_3
        licenseType: *ref_4
        licenseNumber: *ref_5
        documentNumber: *ref_6
        title: *ref_7
        specialty: *ref_8
        workPhone: *ref_9
        address: *ref_10
        province: *ref_11
        profile: &ref_12
          $ref: '#/components/schemas/createProfile'
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend: &ref_13
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone: &ref_14
          type: string
          description: Teléfono que se muestra en el PDF
        address: &ref_15
          type: string
          description: Dirección que se muestra en el PDF
        email: &ref_16
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4: *ref_12
      properties:
        id:
          type: integer
          format: int64
        legend: *ref_13
        phone: *ref_14
        address: *ref_15
        email: *ref_16
        healthCenter:
          $ref: '#/components/schemas/healthCenter'
      required:
        - id
        - legend
        - phone
        - address
        - email
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-ignore-properties:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: &ref_17
          type: string
        address: &ref_18
          type: string
          description: Dirección
        phone: &ref_19
          type: string
          description: Teléfono
        email: &ref_20
          type: string
          format: email
          description: Email
        logoUrl: &ref_21
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_22
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_23
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name: *ref_17
        address: *ref_18
        phone: *ref_19
        email: *ref_20
        logoUrl: *ref_21
        footer: *ref_22
        pdfVersion: *ref_23
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# Obtención de usuarios

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /users:
    get:
      summary: Obtención de usuarios
      deprecated: false
      description: Devuelve la información de los usuarios
      operationId: getUsers
      tags:
        - API/Usuarios
      parameters:
        - name: healthCenterId
          in: query
          description: 'Necesario si se maneja más de una institución '
          required: false
          example: '1'
          schema:
            type: string
        - name: documentNumber
          in: query
          description: Número de documento del médico
          required: false
          example: '40000000'
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/user'
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-7710623-run
components:
  schemas:
    user:
      type: object
      properties:
        id:
          type: integer
          format: int64
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        email: &ref_1
          type: string
          format: email
          description: Email del usuario asociado
        name: &ref_2
          type: string
          description: Nombre del médico
        surname: &ref_3
          type: string
          description: Apellido del médico
        licenseType: &ref_4
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber: &ref_5
          type: string
          description: Número de licencia
        documentNumber: &ref_6
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title: &ref_7
          type: string
          description: '"Dr" o "Dra"'
        specialty: &ref_8
          type: string
          description: Especialidad
        workPhone: &ref_9
          type: string
          description: Número de teléfono del consultorio
        address: &ref_10
          type: string
          description: Dirección del consultorio
        province: &ref_11
          type: string
          description: Name del endpoint /provinces
        profile: &ref_0
          $ref: '#/components/schemas/profile'
        active:
          type: boolean
          description: >-
            Si el usuario está activo o no. Es necesario que lo esté para poder
            hacer requests en su nombre
      x-apidog-orders:
        - id
        - createdDate
        - 01HX30S0CXHW54JNQKXPAVQ6AV
        - active
      required:
        - id
        - createdDate
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
        - active
      x-apidog-refs:
        01HX30S0CXHW54JNQKXPAVQ6AV:
          $ref: '#/components/schemas/createUser'
          x-apidog-overrides:
            profile: *ref_0
          required:
            - profile
      x-apidog-ignore-properties:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email: *ref_1
        name: *ref_2
        surname: *ref_3
        licenseType: *ref_4
        licenseNumber: *ref_5
        documentNumber: *ref_6
        title: *ref_7
        specialty: *ref_8
        workPhone: *ref_9
        address: *ref_10
        province: *ref_11
        profile: &ref_12
          $ref: '#/components/schemas/createProfile'
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend: &ref_13
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone: &ref_14
          type: string
          description: Teléfono que se muestra en el PDF
        address: &ref_15
          type: string
          description: Dirección que se muestra en el PDF
        email: &ref_16
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4: *ref_12
      properties:
        id:
          type: integer
          format: int64
        legend: *ref_13
        phone: *ref_14
        address: *ref_15
        email: *ref_16
        healthCenter:
          $ref: '#/components/schemas/healthCenter'
      required:
        - id
        - legend
        - phone
        - address
        - email
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-ignore-properties:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: &ref_17
          type: string
        address: &ref_18
          type: string
          description: Dirección
        phone: &ref_19
          type: string
          description: Teléfono
        email: &ref_20
          type: string
          format: email
          description: Email
        logoUrl: &ref_21
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_22
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_23
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name: *ref_17
        address: *ref_18
        phone: *ref_19
        email: *ref_20
        logoUrl: *ref_21
        footer: *ref_22
        pdfVersion: *ref_23
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Información del usuario

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /users/{id}:
    get:
      summary: Información del usuario
      deprecated: false
      description: Devuelve la información del usuario especificado por id.
      operationId: getUser
      tags:
        - API/Usuarios
      parameters:
        - name: id
          in: path
          description: ''
          required: true
          example: 0
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/user'
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935232-run
components:
  schemas:
    user:
      type: object
      properties:
        id:
          type: integer
          format: int64
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        email: &ref_1
          type: string
          format: email
          description: Email del usuario asociado
        name: &ref_2
          type: string
          description: Nombre del médico
        surname: &ref_3
          type: string
          description: Apellido del médico
        licenseType: &ref_4
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber: &ref_5
          type: string
          description: Número de licencia
        documentNumber: &ref_6
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title: &ref_7
          type: string
          description: '"Dr" o "Dra"'
        specialty: &ref_8
          type: string
          description: Especialidad
        workPhone: &ref_9
          type: string
          description: Número de teléfono del consultorio
        address: &ref_10
          type: string
          description: Dirección del consultorio
        province: &ref_11
          type: string
          description: Name del endpoint /provinces
        profile: &ref_0
          $ref: '#/components/schemas/profile'
        active:
          type: boolean
          description: >-
            Si el usuario está activo o no. Es necesario que lo esté para poder
            hacer requests en su nombre
      x-apidog-orders:
        - id
        - createdDate
        - 01HX30S0CXHW54JNQKXPAVQ6AV
        - active
      required:
        - id
        - createdDate
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
        - active
      x-apidog-refs:
        01HX30S0CXHW54JNQKXPAVQ6AV:
          $ref: '#/components/schemas/createUser'
          x-apidog-overrides:
            profile: *ref_0
          required:
            - profile
      x-apidog-ignore-properties:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email: *ref_1
        name: *ref_2
        surname: *ref_3
        licenseType: *ref_4
        licenseNumber: *ref_5
        documentNumber: *ref_6
        title: *ref_7
        specialty: *ref_8
        workPhone: *ref_9
        address: *ref_10
        province: *ref_11
        profile: &ref_12
          $ref: '#/components/schemas/createProfile'
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend: &ref_13
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone: &ref_14
          type: string
          description: Teléfono que se muestra en el PDF
        address: &ref_15
          type: string
          description: Dirección que se muestra en el PDF
        email: &ref_16
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4: *ref_12
      properties:
        id:
          type: integer
          format: int64
        legend: *ref_13
        phone: *ref_14
        address: *ref_15
        email: *ref_16
        healthCenter:
          $ref: '#/components/schemas/healthCenter'
      required:
        - id
        - legend
        - phone
        - address
        - email
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-ignore-properties:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name: &ref_17
          type: string
        address: &ref_18
          type: string
          description: Dirección
        phone: &ref_19
          type: string
          description: Teléfono
        email: &ref_20
          type: string
          format: email
          description: Email
        logoUrl: &ref_21
          type: string
          description: URL del logo con un máximo de 250px
        footer: &ref_22
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion: &ref_23
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-ignore-properties:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name: *ref_17
        address: *ref_18
        phone: *ref_19
        email: *ref_20
        logoUrl: *ref_21
        footer: *ref_22
        pdfVersion: *ref_23
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Cambiar estado del usuario

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /users/{id}/status:
    put:
      summary: Cambiar estado del usuario
      deprecated: false
      description: Cambia el estado del usuario, pasando de activo a inactivo y viceversa.
      operationId: setUserStatus
      tags:
        - API/Usuarios
      parameters:
        - name: id
          in: path
          description: ''
          required: true
          example: 0
          schema:
            type: integer
            format: int64
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                active:
                  type: boolean
              x-apidog-orders:
                - active
            example: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
                x-apidog-orders: []
          headers: {}
          x-apidog-name: User status updated successfully
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935234-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Actualizar información del usuario

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /users/{id}:
    put:
      summary: Actualizar información del usuario
      deprecated: false
      description: ''
      operationId: updateUser
      tags:
        - API/Usuarios
      parameters:
        - name: id
          in: path
          description: ''
          required: true
          example: 0
          schema:
            type: integer
            format: int64
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/updateUser'
            example: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  name:
                    type: string
                  surname:
                    type: string
                  documentNumber:
                    type: string
                  title:
                    type: string
                  specialty:
                    type: string
                  workPhone:
                    type: string
                  address:
                    type: string
                  province:
                    type: string
                  profile:
                    type: object
                    x-apidog-refs:
                      01HX32SNPYMAER4ZHCKF0TADBG: &ref_0
                        $ref: '#/components/schemas/createProfile'
                        x-apidog-overrides:
                          healthCenter: null
                    x-apidog-orders:
                      - id
                      - 01HX32SNPYMAER4ZHCKF0TADBG
                    properties:
                      id:
                        type: integer
                        description: ID del perfil a actualizar
                      legend:
                        type: string
                        description: Leyenda que se muestra en el PDF debajo del nombre
                      phone:
                        type: string
                        description: Teléfono que se muestra en el PDF
                      address:
                        type: string
                        description: Dirección que se muestra en el PDF
                      email:
                        type: string
                        description: Email que se muestra en el PDF
                    required:
                      - id
                      - legend
                      - phone
                      - address
                      - email
                    x-apidog-ignore-properties:
                      - legend
                      - phone
                      - address
                      - email
                x-apidog-orders:
                  - name
                  - surname
                  - documentNumber
                  - title
                  - specialty
                  - workPhone
                  - address
                  - province
                  - profile
                x-apidog-refs: {}
                required:
                  - profile
                x-apidog-ignore-properties: []
          headers: {}
          x-apidog-name: User updated successfully
        '401':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  statusCode:
                    type: integer
                  message:
                    type: string
                  error:
                    type: string
                x-apidog-orders:
                  - statusCode
                  - message
                  - error
                x-apidog-ignore-properties: []
          headers: {}
          x-apidog-name: Unauthorized, user is not active
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935233-run
components:
  schemas:
    updateUser:
      type: object
      properties:
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        workPhone:
          type: string
          description: Número de teléfono del consultorio
        address:
          type: string
          description: Dirección del consultorio
        province:
          type: string
          description: Del endpoint /provinces
        profile:
          type: object
          x-apidog-refs:
            01HX32SNPYMAER4ZHCKF0TADBG: *ref_0
          x-apidog-orders:
            - id
            - 01HX32SNPYMAER4ZHCKF0TADBG
          properties:
            id:
              type: integer
              description: ID del perfil a actualizar
            legend: &ref_1
              type: string
              description: Leyenda que se muestra en el PDF debajo del nombre
            phone: &ref_2
              type: string
              description: Teléfono que se muestra en el PDF
            address: &ref_3
              type: string
              description: Dirección que se muestra en el PDF
            email: &ref_4
              type: string
              description: Email que se muestra en el PDF
          required:
            - id
            - legend
            - phone
            - address
            - email
          x-apidog-ignore-properties:
            - legend
            - phone
            - address
            - email
      x-apidog-orders:
        - name
        - surname
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-refs: {}
      required:
        - profile
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend: *ref_1
        phone: *ref_2
        address: *ref_3
        email: *ref_4
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Actualizar firma del usuario

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /users/{id}/signature:
    put:
      summary: Actualizar firma del usuario
      deprecated: false
      description: Actualiza la firma de un usuario
      operationId: updateUserSignature
      tags:
        - API/Usuarios
      parameters:
        - name: id
          in: path
          description: ''
          required: true
          schema:
            type: string
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                signature:
                  type: string
                  format: binary
                  description: Signature
                  example: ''
              required:
                - signature
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: string
          headers: {}
          x-apidog-name: User created successfully
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-7412773-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Obtención de provincias

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /provinces:
    get:
      summary: Obtención de provincias
      deprecated: false
      description: Devuelve las provincias
      operationId: getProvinces
      tags:
        - API/Usuarios
      parameters: []
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: number
                  name:
                    type: string
                    description: name
                x-apidog-orders:
                  - id
                  - name
                required:
                  - id
                  - name
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Usuarios
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-9030356-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Nueva receta

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /prescriptions:
    post:
      summary: Nueva receta
      deprecated: false
      description: >-
        Crea una receta.


        Es posible enviar:

        - medicamentos del
        [vademecum](https://docs.recetario.com.ar/api-8298891)

        - medicamentos fuera del listado del vademecum para recetas magistrales.
      operationId: createPrescription
      tags:
        - API/Prescripciones
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/createPrescription'
            example: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/createdPrescription'
          headers: {}
          x-apidog-name: Prescription created successfully
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935229-run
components:
  schemas:
    createPrescription:
      type: object
      x-apidog-refs:
        01JD32Q37CVEEPHP08DQA8ND46:
          $ref: '#/components/schemas/basePrescription'
          x-apidog-overrides: {}
      properties:
        userId: &ref_6
          type: integer
          description: Id del usuario asociado al médico. No requerido si se envía doctor
          format: int
        doctor: &ref_7
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
        date: &ref_8
          type: string
          description: Fecha a partir de la cual la receta es válida, en formato AAAA-MM-DD
        patient: &ref_9
          description: Información del paciente
          $ref: '#/components/schemas/patient'
        method: &ref_10
          type: string
          enum:
            - vademecum
          default: vademecum
          description: '"vademecum" o "manual"'
        diagnosis: &ref_14
          type: string
          description: Diagnóstico
        reference: &ref_15
          type: string
          description: Referencia externa que permite identificar recetas
        hiv: &ref_16
          type: boolean
          description: Si la receta es para VIH, por defecto es false
        recurring:
          type: object
          properties:
            days:
              type: number
              description: >-
                Días de diferencia entre recetas. Puede ser 30, 60 o 90 (1 mes,
                2 meses o 3 meses respectivamente)
            quantity:
              type: number
              description: Cantidad de recetas recurrentes a emitir
              minimum: 1
              maximum: 11
          x-apidog-orders:
            - days
            - quantity
          description: >-
            Configuración para recetas recurrentes. Aplicable sólo si
            method=vademecum
          required:
            - days
            - quantity
          x-apidog-ignore-properties: []
        medicines:
          type: array
          items:
            type: object
            x-apidog-refs:
              01JFSSSWKWYR8Z32NF688E9YJD:
                $ref: '#/components/schemas/baseMedicine'
                x-apidog-overrides: &ref_13 {}
            properties:
              externalId: &ref_0
                type: string
                description: ExternalId del medicamento (del GET a /medications)
              quantity: &ref_1
                type: number
                description: Cantidad
                minimum: 1
                maximum: 10
              longTerm: &ref_2
                type: boolean
                description: Tratamiento prolongado
                default: false
              posology: &ref_3
                type: string
                description: Posología
              genericOnly: &ref_4
                type: boolean
                description: >-
                  Recetar sólo genérico. Si es true, el texto del PDF no
                  incluirá la marca. En ese caso, brandRecommendation debe ser
                  false
                default: false
              brandRecommendation: &ref_5
                type: boolean
                description: >-
                  Recomendar la marca del medicamento. Si es true, no se permite
                  sustitución. En ese caso, genericOnly debe ser false
                default: false
              requiresDuplicate:
                type: boolean
                description: >-
                  Requiere duplicado. Se calcula automáticamente pero es posible
                  definirlo manualmente
                default: false
              text:
                type: string
                description: >-
                  Texto mostrado en el PDF de la receta, sólo para recetas
                  manuales. No es tenido en cuenta si method=vademecum
            x-apidog-orders:
              - 01JFSSSWKWYR8Z32NF688E9YJD
              - requiresDuplicate
              - text
            required:
              - quantity
              - longTerm
            x-apidog-ignore-properties:
              - externalId
              - quantity
              - longTerm
              - posology
              - genericOnly
              - brandRecommendation
      x-apidog-orders:
        - 01JD32Q37CVEEPHP08DQA8ND46
        - recurring
        - medicines
      required:
        - date
        - patient
        - method
        - diagnosis
        - medicines
      x-apidog-ignore-properties:
        - userId
        - doctor
        - date
        - patient
        - method
        - diagnosis
        - reference
        - hiv
      x-apidog-folder: ''
    baseMedicine:
      type: object
      properties:
        externalId: *ref_0
        quantity: *ref_1
        longTerm: *ref_2
        posology: *ref_3
        requiresDuplicate: &ref_11
          type: boolean
          description: Requiere duplicado
          default: false
        genericOnly: *ref_4
        brandRecommendation: *ref_5
        text: &ref_12
          type: string
          description: Texto mostrado en el PDF de la receta
      required:
        - quantity
        - longTerm
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - gender
        - birthDate
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    basePrescription:
      type: object
      properties:
        userId: *ref_6
        doctor: *ref_7
        date: *ref_8
        patient: *ref_9
        method: *ref_10
        medicines:
          type: array
          items:
            properties:
              externalId: *ref_0
              quantity: *ref_1
              longTerm: *ref_2
              posology: *ref_3
              requiresDuplicate: *ref_11
              genericOnly: *ref_4
              brandRecommendation: *ref_5
              text: *ref_12
            x-apidog-orders: &ref_17
              - 01JFSSRHWJX4XFYX75XAJ9WY3S
            type: object
            x-apidog-refs: &ref_18
              01JFSSRHWJX4XFYX75XAJ9WY3S:
                x-apidog-overrides: *ref_13
                type: object
                properties: {}
            required:
              - quantity
              - longTerm
              - requiresDuplicate
              - text
            x-apidog-ignore-properties:
              - externalId
              - quantity
              - longTerm
              - posology
              - requiresDuplicate
              - genericOnly
              - brandRecommendation
              - text
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis: *ref_14
        reference: *ref_15
        hiv: *ref_16
      required:
        - date
        - patient
        - method
        - medicines
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createdPrescription:
      type: object
      x-apidog-refs:
        01JD330RMKP2BHHYXFRJ23AYDY:
          x-apidog-overrides: {}
          type: object
          properties: {}
      properties:
        id:
          type: integer
          format: int64
          description: Id de la receta
        userId: *ref_6
        doctor: *ref_7
        date: *ref_8
        patient: *ref_9
        method: *ref_10
        medicines:
          type: array
          items:
            properties:
              externalId: *ref_0
              quantity: *ref_1
              longTerm: *ref_2
              posology: *ref_3
              requiresDuplicate: *ref_11
              genericOnly: *ref_4
              brandRecommendation: *ref_5
              text: *ref_12
            x-apidog-orders: *ref_17
            type: object
            x-apidog-refs: *ref_18
            required:
              - quantity
              - longTerm
              - requiresDuplicate
              - text
            x-apidog-ignore-properties:
              - externalId
              - quantity
              - longTerm
              - posology
              - requiresDuplicate
              - genericOnly
              - brandRecommendation
              - text
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis: *ref_14
        reference: *ref_15
        hiv: *ref_16
        externalId:
          type: string
          description: >-
            Si method=vademecum, el número de receta. Es el código de barras del
            PDF
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        url:
          type: string
          format: uri
          description: URL al PDF de la receta
        recurring:
          type: object
          properties:
            id:
              type: number
              description: Id de la receta
            date:
              type: string
              format: date-time
              description: Fecha de creación
            externalId:
              type: string
              description: El número de receta
            url:
              type: string
              description: URL al PDF de la receta
          x-apidog-orders:
            - id
            - date
            - externalId
            - url
          description: Recetas recurrentes
          required:
            - id
            - date
            - externalId
            - url
          x-apidog-ignore-properties: []
      x-apidog-orders:
        - 01JD330RMKP2BHHYXFRJ23AYDY
        - recurring
      required:
        - id
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - createdDate
        - url
      x-apidog-ignore-properties:
        - id
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
        - externalId
        - createdDate
        - url
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Nueva orden

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /orders:
    post:
      summary: Nueva orden
      deprecated: false
      description: >-
        Crea una orden.


        Puede emitirse cualquier tipo de orden médica: de estudio, licencia,
        certificado, etc.
      operationId: createOrder
      tags:
        - API/Prescripciones
      parameters: []
      requestBody:
        content:
          application/json:
            schema: &ref_7
              $ref: '#/components/schemas/createOrder'
            example: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/order'
          headers: {}
          x-apidog-name: Order created successfully
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-6935230-run
components:
  schemas:
    createOrder:
      type: object
      properties:
        userId: &ref_0
          type: integer
          format: int64
          description: Id del usuario asociado al médico. No requerido si se envía doctor
        doctor: &ref_1
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
        date: &ref_2
          type: string
          description: Fecha a partir de la cual la órden es válida, en formato AAAA-MM-DD
        patient: &ref_3
          $ref: '#/components/schemas/patient'
          description: Información del paciente
        medicine: &ref_4
          type: string
          description: Texto a mostrar en el PDF de la orden.
        diagnosis: &ref_5
          type: string
          description: Diagnóstico
        reference: &ref_6
          type: string
          description: Referencia externa que permite identificar órdenes
      required:
        - date
        - patient
        - medicine
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - medicine
        - diagnosis
        - reference
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - gender
        - birthDate
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    order:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Id de la orden
        url:
          type: string
          format: uri
          description: URL al PDF de la orden
        userId: *ref_0
        doctor: *ref_1
        date: *ref_2
        patient: *ref_3
        medicine: *ref_4
        diagnosis: *ref_5
        reference: *ref_6
      x-apidog-orders:
        - id
        - url
        - 01HX31YZ94JRHKPERV2PVNEYJW
      required:
        - id
        - url
        - date
        - patient
        - medicine
        - diagnosis
      x-apidog-refs:
        01HX31YZ94JRHKPERV2PVNEYJW: *ref_7
      x-apidog-ignore-properties:
        - userId
        - doctor
        - date
        - patient
        - medicine
        - diagnosis
        - reference
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Obtención de prescripciones

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /medical-documents:
    get:
      summary: Obtención de prescripciones
      deprecated: false
      description: Devuelve las recetas y órdenes de una institución
      operationId: getPrescriptions
      tags:
        - API/Prescripciones
      parameters:
        - name: filter.reference
          in: query
          description: >-
            Filtro por reference envíado al crear la receta/orden. Admite "$in:"
            para buscar múltiples valores
          required: false
          example: >-
            Para buscar un único valor: "unReference"

            Para buscar por un conjnuto de valores:
            "$in:unReference,otroReference"
          schema:
            type: string
        - name: filter.patient.documentNumber
          in: query
          description: Filtro por número de documento del paciente
          required: false
          schema:
            type: string
        - name: healthCenterId
          in: query
          description: Id de la institución. Obligatorio si se maneja más de uno
          required: false
          schema:
            type: integer
        - name: filter.id
          in: query
          description: Filtro por identificador de recetario
          required: false
          schema:
            type: number
        - name: filter.user.id
          in: query
          description: Filtro por identificador de usuario. Id del médico
          required: false
          schema:
            type: number
        - name: filter.orderType
          in: query
          description: Filtro por tipo de orden
          required: false
          schema:
            type: string
            enum:
              - imaging
              - laboratory
              - manual
            x-apidog-enum:
              - value: imaging
                name: Estudio por imágenes
                description: ''
              - value: laboratory
                name: Laboratorio
                description: ''
              - value: manual
                name: Manual
                description: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                x-apidog-refs: {}
                properties:
                  data:
                    type: array
                    items:
                      anyOf:
                        - type: object
                          x-apidog-refs:
                            01JFSTJ8HD4PGH9MHG425MPK6N:
                              $ref: '#/components/schemas/prescription'
                              x-apidog-overrides: {}
                          properties:
                            id:
                              type: integer
                              format: int64
                              description: Id de la receta
                            userId:
                              type: integer
                              description: >-
                                Id del usuario asociado al médico. No requerido
                                si se envía doctor
                              format: int
                            doctor: &ref_0
                              $ref: '#/components/schemas/doctor'
                              description: >-
                                Información del médico. No requerido si se envía
                                userId
                            date:
                              type: string
                              description: >-
                                Fecha a partir de la cual la receta es válida,
                                en formato AAAA-MM-DD
                            patient: &ref_1
                              description: Información del paciente
                              $ref: '#/components/schemas/patient'
                            method:
                              type: string
                              enum:
                                - vademecum
                              default: vademecum
                              description: '"vademecum" o "manual"'
                            medicines:
                              type: array
                              items:
                                properties:
                                  externalId:
                                    type: string
                                    description: >-
                                      ExternalId del medicamento (del GET a
                                      /medications)
                                  quantity:
                                    type: number
                                    description: Cantidad
                                    minimum: 1
                                    maximum: 10
                                  longTerm:
                                    type: boolean
                                    description: Tratamiento prolongado
                                    default: false
                                  posology:
                                    type: string
                                    description: Posología
                                  requiresDuplicate:
                                    type: boolean
                                    description: Requiere duplicado
                                    default: false
                                  genericOnly:
                                    type: boolean
                                    description: >-
                                      Recetar sólo genérico. Si es true, el
                                      texto del PDF no incluirá la marca. En ese
                                      caso, brandRecommendation debe ser false
                                    default: false
                                  brandRecommendation:
                                    type: boolean
                                    description: >-
                                      Recomendar la marca del medicamento. Si es
                                      true, no se permite sustitución. En ese
                                      caso, genericOnly debe ser false
                                    default: false
                                  text:
                                    type: string
                                    description: Texto mostrado en el PDF de la receta
                                x-apidog-orders:
                                  - 01JFSSRHWJX4XFYX75XAJ9WY3S
                                type: object
                                x-apidog-refs:
                                  01JFSSRHWJX4XFYX75XAJ9WY3S: &ref_15
                                    $ref: '#/components/schemas/baseMedicine'
                                    x-apidog-overrides: {}
                                required:
                                  - quantity
                                  - longTerm
                                  - requiresDuplicate
                                  - text
                                x-apidog-ignore-properties:
                                  - externalId
                                  - quantity
                                  - longTerm
                                  - posology
                                  - requiresDuplicate
                                  - genericOnly
                                  - brandRecommendation
                                  - text
                              maxItems: 3
                              description: >-
                                Medicamentos. Obtenidos a partir del endpoint
                                /medications
                            diagnosis:
                              type: string
                              description: Diagnóstico
                            reference:
                              type: string
                              description: >-
                                Referencia externa que permite identificar
                                recetas
                            hiv:
                              type: boolean
                              description: Si la receta es para VIH, por defecto es false
                            externalId:
                              type: string
                              description: >-
                                Si method=vademecum, el número de receta. Es el
                                código de barras del PDF
                            createdDate:
                              type: string
                              format: date-time
                              description: Fecha de creación
                            url:
                              type: string
                              format: uri
                              description: URL al PDF de la receta
                            type:
                              type: string
                              description: Si es una receta, "prescription". Sino, "order"
                          required:
                            - id
                            - date
                            - patient
                            - method
                            - medicines
                            - diagnosis
                            - createdDate
                            - url
                            - type
                          x-apidog-orders:
                            - 01JFSTJ8HD4PGH9MHG425MPK6N
                            - type
                          description: Receta
                          x-apidog-ignore-properties:
                            - id
                            - userId
                            - doctor
                            - date
                            - patient
                            - method
                            - medicines
                            - diagnosis
                            - reference
                            - hiv
                            - externalId
                            - createdDate
                            - url
                        - type: object
                          x-apidog-refs:
                            01JFSTK1741281QXST1A6WFWNE:
                              $ref: '#/components/schemas/order'
                              x-apidog-overrides: {}
                          properties:
                            id:
                              type: integer
                              format: int64
                              description: Id de la orden
                            url:
                              type: string
                              format: uri
                              description: URL al PDF de la orden
                            userId:
                              type: integer
                              format: int64
                              description: >-
                                Id del usuario asociado al médico. No requerido
                                si se envía doctor
                            doctor: *ref_0
                            date:
                              type: string
                              description: >-
                                Fecha a partir de la cual la órden es válida, en
                                formato AAAA-MM-DD
                            patient: *ref_1
                            medicine:
                              type: string
                              description: Texto a mostrar en el PDF de la orden.
                            diagnosis:
                              type: string
                              description: Diagnóstico
                            reference:
                              type: string
                              description: >-
                                Referencia externa que permite identificar
                                órdenes
                            type:
                              type: string
                              description: Si es una receta, "prescription". Sino, "order"
                          required:
                            - id
                            - url
                            - date
                            - patient
                            - medicine
                            - diagnosis
                            - type
                          x-apidog-orders:
                            - 01JFSTK1741281QXST1A6WFWNE
                            - type
                          description: Orden
                          x-apidog-ignore-properties:
                            - id
                            - url
                            - userId
                            - doctor
                            - date
                            - patient
                            - medicine
                            - diagnosis
                            - reference
                  meta:
                    type: object
                    properties:
                      itemsPerPage:
                        type: number
                        description: Cantidad de items por página
                      totalItems:
                        type: number
                        description: Cantidad total de items
                      currentPage:
                        type: number
                        description: Página actual
                      totalPages:
                        type: number
                        description: Cantidad total de páginas
                    x-apidog-orders:
                      - itemsPerPage
                      - totalItems
                      - currentPage
                      - totalPages
                    required:
                      - itemsPerPage
                      - totalItems
                      - currentPage
                      - totalPages
                    description: Metadata de la paginación
                    x-apidog-ignore-properties: []
                  links:
                    type: object
                    properties:
                      current:
                        type: string
                        description: Url de la página actual
                      next:
                        type: string
                        description: Url de la página siguiente
                      last:
                        type: string
                        description: Url de la última página
                    x-apidog-orders:
                      - current
                      - next
                      - last
                    required:
                      - current
                      - next
                      - last
                    x-apidog-ignore-properties: []
                x-apidog-orders:
                  - data
                  - meta
                  - links
                required:
                  - data
                  - meta
                  - links
                x-apidog-ignore-properties: []
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-7801235-run
components:
  schemas:
    order:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Id de la orden
        url:
          type: string
          format: uri
          description: URL al PDF de la orden
        userId: &ref_2
          type: integer
          format: int64
          description: Id del usuario asociado al médico. No requerido si se envía doctor
        doctor: *ref_0
        date: &ref_3
          type: string
          description: Fecha a partir de la cual la órden es válida, en formato AAAA-MM-DD
        patient: *ref_1
        medicine: &ref_4
          type: string
          description: Texto a mostrar en el PDF de la orden.
        diagnosis: &ref_5
          type: string
          description: Diagnóstico
        reference: &ref_6
          type: string
          description: Referencia externa que permite identificar órdenes
      x-apidog-orders:
        - id
        - url
        - 01HX31YZ94JRHKPERV2PVNEYJW
      required:
        - id
        - url
        - date
        - patient
        - medicine
        - diagnosis
      x-apidog-refs:
        01HX31YZ94JRHKPERV2PVNEYJW:
          $ref: '#/components/schemas/createOrder'
      x-apidog-ignore-properties:
        - userId
        - doctor
        - date
        - patient
        - medicine
        - diagnosis
        - reference
      x-apidog-folder: ''
    createOrder:
      type: object
      properties:
        userId: *ref_2
        doctor: *ref_0
        date: *ref_3
        patient: *ref_1
        medicine: *ref_4
        diagnosis: *ref_5
        reference: *ref_6
      required:
        - date
        - patient
        - medicine
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - medicine
        - diagnosis
        - reference
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    baseMedicine:
      type: object
      properties:
        externalId: &ref_7
          type: string
          description: ExternalId del medicamento (del GET a /medications)
        quantity: &ref_8
          type: number
          description: Cantidad
          minimum: 1
          maximum: 10
        longTerm: &ref_9
          type: boolean
          description: Tratamiento prolongado
          default: false
        posology: &ref_10
          type: string
          description: Posología
        requiresDuplicate: &ref_11
          type: boolean
          description: Requiere duplicado
          default: false
        genericOnly: &ref_12
          type: boolean
          description: >-
            Recetar sólo genérico. Si es true, el texto del PDF no incluirá la
            marca. En ese caso, brandRecommendation debe ser false
          default: false
        brandRecommendation: &ref_13
          type: boolean
          description: >-
            Recomendar la marca del medicamento. Si es true, no se permite
            sustitución. En ese caso, genericOnly debe ser false
          default: false
        text: &ref_14
          type: string
          description: Texto mostrado en el PDF de la receta
      required:
        - quantity
        - longTerm
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - gender
        - birthDate
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    prescription:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Id de la receta
        userId: &ref_16
          type: integer
          description: Id del usuario asociado al médico. No requerido si se envía doctor
          format: int
        doctor: *ref_0
        date: &ref_17
          type: string
          description: Fecha a partir de la cual la receta es válida, en formato AAAA-MM-DD
        patient: *ref_1
        method: &ref_18
          type: string
          enum:
            - vademecum
          default: vademecum
          description: '"vademecum" o "manual"'
        medicines:
          type: array
          items:
            properties:
              externalId: *ref_7
              quantity: *ref_8
              longTerm: *ref_9
              posology: *ref_10
              requiresDuplicate: *ref_11
              genericOnly: *ref_12
              brandRecommendation: *ref_13
              text: *ref_14
            x-apidog-orders: &ref_19
              - 01JFSSRHWJX4XFYX75XAJ9WY3S
            type: object
            x-apidog-refs: &ref_20
              01JFSSRHWJX4XFYX75XAJ9WY3S: *ref_15
            required:
              - quantity
              - longTerm
              - requiresDuplicate
              - text
            x-apidog-ignore-properties:
              - externalId
              - quantity
              - longTerm
              - posology
              - requiresDuplicate
              - genericOnly
              - brandRecommendation
              - text
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis: &ref_21
          type: string
          description: Diagnóstico
        reference: &ref_22
          type: string
          description: Referencia externa que permite identificar recetas
        hiv: &ref_23
          type: boolean
          description: Si la receta es para VIH, por defecto es false
        externalId:
          type: string
          description: >-
            Si method=vademecum, el número de receta. Es el código de barras del
            PDF
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        url:
          type: string
          format: uri
          description: URL al PDF de la receta
      x-apidog-orders:
        - id
        - 01HX31XYG91W1Y6E09YZ0P75RQ
        - externalId
        - createdDate
        - url
      required:
        - id
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - createdDate
        - url
      x-apidog-refs:
        01HX31XYG91W1Y6E09YZ0P75RQ:
          $ref: '#/components/schemas/basePrescription'
      x-apidog-ignore-properties:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-folder: ''
    basePrescription:
      type: object
      properties:
        userId: *ref_16
        doctor: *ref_0
        date: *ref_17
        patient: *ref_1
        method: *ref_18
        medicines:
          type: array
          items:
            properties:
              externalId: *ref_7
              quantity: *ref_8
              longTerm: *ref_9
              posology: *ref_10
              requiresDuplicate: *ref_11
              genericOnly: *ref_12
              brandRecommendation: *ref_13
              text: *ref_14
            x-apidog-orders: *ref_19
            type: object
            x-apidog-refs: *ref_20
            required:
              - quantity
              - longTerm
              - requiresDuplicate
              - text
            x-apidog-ignore-properties:
              - externalId
              - quantity
              - longTerm
              - posology
              - requiresDuplicate
              - genericOnly
              - brandRecommendation
              - text
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis: *ref_21
        reference: *ref_22
        hiv: *ref_23
      required:
        - date
        - patient
        - method
        - medicines
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Obtención de medicamentos

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /medications:
    get:
      summary: Obtención de medicamentos
      deprecated: false
      description: Devuelve los medicamentos buscados
      operationId: getMedications
      tags:
        - API/Prescripciones
      parameters:
        - name: search
          in: query
          description: Texto a buscar. Busca por nombre comercial, droga, o presentación
          required: true
          example: ibu
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/medication'
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-8298891-run
components:
  schemas:
    medication:
      type: object
      properties:
        id:
          type: number
          description: Id
        brand:
          type: string
          description: Marca comercial
        drug:
          type: string
          description: Principio activo
        requiresDuplicate:
          type: boolean
          description: Si requiere duplicado
        hivSpecific:
          type: boolean
          description: Si es específico para VIH
        packages:
          description: Presentaciones
          $ref: '#/components/schemas/medicationPackage'
      x-apidog-orders:
        - id
        - brand
        - drug
        - requiresDuplicate
        - hivSpecific
        - packages
      required:
        - id
        - brand
        - drug
        - requiresDuplicate
        - hivSpecific
        - packages
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    medicationPackage:
      type: object
      properties:
        id:
          type: number
          description: Id
        name:
          type: string
          description: Nombre de la presentación
        externalId:
          type: string
          description: Id a utilizar al momento de generar una nueva receta
        shape:
          type: string
          description: Forma farmacéutica
        action:
          type: string
          description: Acción farmacológica
        barcode:
          type: string
          description: Código de barras del producto
        power:
          type: object
          properties:
            value:
              type: string
              description: >-
                Valor de la potencia (ej: "100", "100/200" para medicamentos
                multidroga
            unit:
              type: string
              description: 'Unidad de la potencia (ej: "mg", "mg/5 ml")'
          x-apidog-orders:
            - value
            - unit
          required:
            - value
            - unit
          description: Potencia
          x-apidog-ignore-properties: []
      x-apidog-orders:
        - id
        - name
        - externalId
        - shape
        - action
        - barcode
        - power
      description: Presentaciones
      required:
        - id
        - name
        - externalId
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Obtención de ooss/prepagas

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /health-insurances:
    get:
      summary: Obtención de ooss/prepagas
      deprecated: false
      description: Devuelve las obras sociales y prepagas
      operationId: getHealthInsurances
      tags:
        - API/Prescripciones
      parameters: []
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  name:
                    type: string
                    description: name
                x-apidog-orders:
                  - id
                  - name
                required:
                  - id
                  - name
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-9030329-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Anular receta

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /prescriptions/{id}/cancel:
    post:
      summary: Anular receta
      deprecated: false
      description: Anula la receta especificada por id
      operationId: cancelPrescription
      tags:
        - API/Prescripciones
      parameters:
        - name: id
          in: path
          description: id de la receta a cancelar
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-10626506-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Compartir prescripciones

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /medical-documents/share:
    post:
      summary: Compartir prescripciones
      deprecated: false
      description: >-
        :::highlight orange 📌

        Requiere acceso. [Pedilo acá](mailto:institucional@recetario.com.ar)

        :::


        Permite compartir prescripciones utilizando:

        - WhatsApp: desde el número oficial de Recetario*

        - Email: desde el mail oficial de Recetario*



        Se deben proporcionar los IDs de los documentos, el método de envío y el
        destino. En caso de ser más de una prescripción, deben pertenecer al
        mismo destinatario.


        *En caso de requerir otro origen, agregarlo en la solicitud de acceso.
      tags:
        - API/Prescripciones
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                ids:
                  type: array
                  items:
                    type: number
                  description: Lista con IDs de documentos a compartir
                method:
                  type: string
                  description: Canal de comunicación a utilizar (whatsapp, email)
                  examples:
                    - email
                    - whatsapp
                destination:
                  type: string
                  description: >
                    En el caso de WhatsApp, un único número de teléfono sin
                    código de país,  sin "+", con código de área, sin 0 ni 15.
                    Ej: 1140000000. Sin espacios ni guiones


                    En el caso de email: una lista de direcciones de correo
                    electrónico separados por coma
                  examples:
                    - prueba@recetario.com.ar,prueba2@recetario.com.ar
                    - prueba@recetario.com.ar
                    - '1140011000'
              x-apidog-orders:
                - ids
                - method
                - destination
              required:
                - ids
                - method
                - destination
            examples:
              '1':
                value:
                  ids:
                    - 1191
                    - 151
                  method: whatsapp
                  destination: '1190000000'
                summary: Example 1
              '2':
                value:
                  ids:
                    - 1191
                    - 151
                  method: email
                  destination: prueba@recetario.com.ar
                summary: Example 2
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Prescripciones
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-15869040-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# Agregar o actualizar un paciente

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /patients:
    put:
      summary: Agregar o actualizar un paciente
      deprecated: false
      description: >-
        Agregar un paciente nuevo o modificar uno existente por número de
        documento.
      tags:
        - API/Pacientes
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                healthInsurance:
                  type: string
                  description: >-
                    Nombre de la obra social/prepaga. Obtenido del endpoint
                    /health-insurances
                insuranceNumber:
                  type: string
                  description: >-
                    Número de afiliado sin caracteres especiales (puntos,
                    guiones o barras). Opcional si healthInsurance: "particular"
                name:
                  type: string
                  description: Nombre
                surname:
                  type: string
                  description: Apellido
                documentNumber:
                  type: string
                  description: Número de documento, sin espacios, puntos o guiones
                email:
                  type: string
                  format: email
                  description: Email
                  nullable: true
                phone:
                  type: string
                  description: Teléfono
                  nullable: true
                gender:
                  type: string
                  description: >-
                    Género del paciente. "m" si es hombre, "f" si es mujer, "o"
                    si es otro
                birthDate:
                  type: string
                  description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
                healthCenterId:
                  type: integer
                  description: >-
                    El id de la institución. Obligatorio si se maneja más de una
                    institución
                  nullable: true
              x-apidog-orders:
                - 01J97ADFBFR49ETHHR39QJXBBC
                - healthCenterId
              x-apidog-refs:
                01J97ADFBFR49ETHHR39QJXBBC:
                  $ref: '#/components/schemas/patient'
              required:
                - healthInsurance
                - name
                - surname
                - documentNumber
                - gender
                - birthDate
              x-apidog-ignore-properties:
                - healthInsurance
                - insuranceNumber
                - name
                - surname
                - documentNumber
                - email
                - phone
                - gender
                - birthDate
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
                x-apidog-orders: []
                x-apidog-ignore-properties: []
          headers: {}
          x-apidog-name: Success
      security: []
      x-apidog-folder: API/Pacientes
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/520999/apis/api-10481965-run
components:
  schemas:
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - gender
        - birthDate
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

# Webhooks
---

# Primeros pasos

## Introducción

Los webhooks permiten recibir notificaciones en tu sistema cuando ocurren eventos en Recetario.
Por cada evento al que estés suscripto, Recetario envía una solicitud `POST` a un endpoint de tu sistema con la información del evento.

## Configuración
Para empezar a emitir los eventos, deberás escribir un [mail](mailto:soporte.it@recetario.com.ar) con asunto *Alta webhooks* y el siguiente contenido:
- URL del endpoint
- Secret (ver Autenticación)
- Eventos de interés


[Acá](/doc-1867814) podés encontrar el detalle de los eventos.
Una vez configurado, los eventos comenzarán a enviarse automáticamente cuando ocurran.

## Detalles de implementación
El endpoint debe responder con un código HTTP `200` dentro de los 30 segundos.
**Cualquier otro status o timeout se considera un fallo y habilita el mecanismo de <ins>[reintentos](#reintentos)</ins>.**

## Autenticación
El endpoint que expongas debe validar la autenticación en cada request entrante. Soportamos dos métodos:

### Opción 1: Bearer Token

```http
Authorization: Bearer <TOKEN>
```
Si el token es inválido o está ausente, el endpoint debe responder con un código HTTP `401`.

**Cuándo usarlo**: Para integraciones simples donde un token estático es suficiente.

### Opción 2: HMAC-SHA256
En este caso, enviamos los siguientes headers en cada request:
| Header | Descripción |
| --- | --- |
| X-Timestamp | Unix timestamp en segundos del momento de envío |
| X-Request-Id | ID único del evento (UUID), útil para idempotencia |
| X-Signature | Firma HMAC-SHA256 con formato sha256={firma_hex} |

**Verificación de la firma**
El string a firmar se construye de la siguiente manera:
`{X-Timestamp}.{X-Request-Id}.{body}`
Donde `body` es el contenido completo del POST tal como llega (UTF-8), sin parsearlo ni reordenarlo.

Si la verificación de la firma falla, el endpoint debe responder con un código HTTP `401`.

:::highlight blue 📝
Nota: El body del webhook podría contener campos adicionales en el futuro. Al verificar la firma sobre el body raw completo, cualquier campo nuevo queda automáticamente cubierto. Tu implementación debe ignorar campos desconocidos al procesar el JSON.
:::

**Cuándo usarlo**: Para integraciones que requieren mayor seguridad, verificación de integridad del mensaje, y protección contra ataques de replay (validando tolerancia del timestamp).


:::highlight orange 💡
Nunca expongas credenciales en un repositorio público, ni las utilices en tu código client-side. Siempre hacelo de manera segura desde tu servidor.
:::

## Reintentos
En caso de que no podamos entregar un evento, se reintentará hasta 2 veces dentro de un período de 5 minutos.
Si todos los intentos fallan, el evento se descarta.



# Eventos

Todos los webhooks se envían vía HTTP `POST` y comparten el mismo envelope:
- `event.type` identifica el evento emitido
- `version` indica la versión del payload

## medical-documents.created
Se emite al momento de finalizar el flujo de prescripción, lo cual crea una o más recetas u órdenes.

**Disponible para integraciones**
- frontend
- botón embebible

**Casos de uso comunes**
- Detectar nuevas prescripciones
- Sincronizar documentos con sistemas externos

```
{
  "version": "1.0",
  "event": {
    "type": "medical-documents.created"
  },
  "data": {
    "medicalDocuments": [
      {
        "id": number,
        "type": "order" | "prescription",
        "url": string
      }
    ],
    "reference": string
  }
}
```
### Detalle de los campos:
- `url`: contiene la url firmada para obtener el base64 del PDF de la prescripción.

## medical-documents.shared
Se emite cuando uno o más documentos médicos son compartidos con un destinatario externo.


**Disponible para integraciones**
- frontend
- botón embebible

**Casos de uso comunes**
- Compartir prescripciones directamente desde tu sistema
- Registrar destinatarios a los cuales se compartió la prescripción


```
{
  "version": "1.0",
  "event": {
    "type": "medical-documents.shared"
  },
  "data": {
    "medicalDocuments": {
        "id": number,
        "url": string
    }[]
    "download": {
      "url": string,
      "urlSuffix": string
    },
    "shareOptions": {
      "method": "whatsapp" | "email",
      "destination": string
    },
    "reference": string
  }
}
```

### Detalle de los campos:
- `download.url`: contiene la url que permite descargar todas las prescripciones.
- `download.urlSuffix`: contiene el sufijo variable de la url que permite descargar las prescripciones (es decir, es el sufijo de `download.url`). Es útil para usar plantillas de Meta con URLs dinámicas (donde la base es fija y debe coincidir con la de `download.url`).
En caso de querer enviar las prescripciones en mensajes separados, debe enviarse `medicalDocuments[i].url`
- `shareOptions.destination`:
    - si `shareOptions.method: "whatsapp"`, contiene el número de teléfono del destinatario. Puede contener o no el código de país (54), según si el médico lo completa o no.
    - si `shareOptions.method: "email"` contiene la dirección de email del destinatario.

:::highlight orange 💡
Los eventos de WhatsApp solo se envían si dicha opción está habilitada en la configuración.
:::


# Schemas
---
# doctor

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# patient

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# updateUser

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    updateUser:
      type: object
      properties:
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        workPhone:
          type: string
          description: Número de teléfono del consultorio
        address:
          type: string
          description: Dirección del consultorio
        province:
          type: string
          description: Del endpoint /provinces
        profile:
          type: object
          x-apidog-refs:
            01HX32SNPYMAER4ZHCKF0TADBG:
              $ref: '#/components/schemas/createProfile'
              x-apidog-overrides:
                healthCenter: null
          x-apidog-orders:
            - id
            - 01HX32SNPYMAER4ZHCKF0TADBG
          properties:
            id:
              type: integer
              description: ID del perfil a actualizar
          required:
            - id
      x-apidog-orders:
        - name
        - surname
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      x-apidog-refs: {}
      required:
        - profile
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# baseMedicine

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    baseMedicine:
      type: object
      properties:
        longTerm:
          type: boolean
          description: Tratamiento prolongado
          default: false
        quantity:
          type: number
          description: Cantidad
          minimum: 1
          maximum: 10
        externalId:
          type: string
          description: ExternalId del medicamento (del GET a /medications)
        requiresDuplicate:
          type: boolean
          description: Requiere duplicado
          default: false
        posology:
          type: string
          description: Posología
        genericOnly:
          type: boolean
          description: >-
            Recetar sólo genérico. Si es true, el texto del PDF no incluirá la
            marca. En ese caso, brandRecommendation debe ser false
          default: false
        text:
          type: string
          description: Texto mostrado en el PDF de la receta
        brandRecommendation:
          type: boolean
          description: >-
            Recomendar la marca del medicamento. Si es true, no se permite
            sustitución. En ese caso, genericOnly debe ser false
          default: false
      required:
        - longTerm
        - quantity
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# basePrescription

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    baseMedicine:
      type: object
      properties:
        longTerm:
          type: boolean
          description: Tratamiento prolongado
          default: false
        quantity:
          type: number
          description: Cantidad
          minimum: 1
          maximum: 10
        externalId:
          type: string
          description: ExternalId del medicamento (del GET a /medications)
        requiresDuplicate:
          type: boolean
          description: Requiere duplicado
          default: false
        posology:
          type: string
          description: Posología
        genericOnly:
          type: boolean
          description: >-
            Recetar sólo genérico. Si es true, el texto del PDF no incluirá la
            marca. En ese caso, brandRecommendation debe ser false
          default: false
        text:
          type: string
          description: Texto mostrado en el PDF de la receta
        brandRecommendation:
          type: boolean
          description: >-
            Recomendar la marca del medicamento. Si es true, no se permite
            sustitución. En ese caso, genericOnly debe ser false
          default: false
      required:
        - longTerm
        - quantity
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    basePrescription:
      type: object
      properties:
        userId:
          type: integer
          description: Id del usuario asociado al médico. No requerido si se envía doctor
          format: int
        date:
          type: string
          description: Fecha a partir de la cual la receta es válida, en formato AAAA-MM-DD
        patient:
          description: Información del paciente
          $ref: '#/components/schemas/patient'
        method:
          type: string
          enum:
            - vademecum
          default: vademecum
          description: '"vademecum" o "manual"'
        medicines:
          type: array
          items:
            properties: {}
            x-apidog-orders:
              - 01JFSSRHWJX4XFYX75XAJ9WY3S
            type: object
            x-apidog-refs:
              01JFSSRHWJX4XFYX75XAJ9WY3S:
                $ref: '#/components/schemas/baseMedicine'
                x-apidog-overrides: {}
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis:
          type: string
          description: Diagnóstico
        reference:
          type: string
          description: Referencia externa que permite identificar recetas
        doctor:
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
        hiv:
          type: boolean
          description: Si la receta es para VIH, por defecto es false
      required:
        - date
        - patient
        - method
        - medicines
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# createPrescription

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    baseMedicine:
      type: object
      properties:
        longTerm:
          type: boolean
          description: Tratamiento prolongado
          default: false
        quantity:
          type: number
          description: Cantidad
          minimum: 1
          maximum: 10
        externalId:
          type: string
          description: ExternalId del medicamento (del GET a /medications)
        requiresDuplicate:
          type: boolean
          description: Requiere duplicado
          default: false
        posology:
          type: string
          description: Posología
        genericOnly:
          type: boolean
          description: >-
            Recetar sólo genérico. Si es true, el texto del PDF no incluirá la
            marca. En ese caso, brandRecommendation debe ser false
          default: false
        text:
          type: string
          description: Texto mostrado en el PDF de la receta
        brandRecommendation:
          type: boolean
          description: >-
            Recomendar la marca del medicamento. Si es true, no se permite
            sustitución. En ese caso, genericOnly debe ser false
          default: false
      required:
        - longTerm
        - quantity
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-folder: ''
    createPrescription:
      type: object
      x-apidog-refs:
        01JD32Q37CVEEPHP08DQA8ND46:
          $ref: '#/components/schemas/basePrescription'
          x-apidog-overrides: {}
      properties:
        recurring:
          type: object
          properties:
            days:
              type: number
              description: >-
                Días de diferencia entre recetas. Puede ser 30, 60 o 90 (1 mes,
                2 meses o 3 meses respectivamente)
            quantity:
              type: number
              description: Cantidad de recetas recurrentes a emitir
              minimum: 1
              maximum: 11
          x-apidog-orders:
            - days
            - quantity
          description: >-
            Configuración para recetas recurrentes. Aplicable sólo si
            method=vademecum
          required:
            - days
            - quantity
        medicines:
          type: array
          items:
            type: object
            x-apidog-refs:
              01JFSSSWKWYR8Z32NF688E9YJD: &ref_0
                $ref: '#/components/schemas/baseMedicine'
                x-apidog-overrides: {}
            properties:
              requiresDuplicate:
                type: boolean
                description: >-
                  Requiere duplicado. Se calcula automáticamente pero es posible
                  definirlo manualmente
                default: false
              text:
                type: string
                description: >-
                  Texto mostrado en el PDF de la receta, sólo para recetas
                  manuales. No es tenido en cuenta si method=vademecum
            x-apidog-orders:
              - 01JFSSSWKWYR8Z32NF688E9YJD
              - requiresDuplicate
              - text
      x-apidog-orders:
        - 01JD32Q37CVEEPHP08DQA8ND46
        - recurring
        - medicines
      required:
        - medicines
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    basePrescription:
      type: object
      properties:
        userId:
          type: integer
          description: Id del usuario asociado al médico. No requerido si se envía doctor
          format: int
        date:
          type: string
          description: Fecha a partir de la cual la receta es válida, en formato AAAA-MM-DD
        patient:
          description: Información del paciente
          $ref: '#/components/schemas/patient'
        method:
          type: string
          enum:
            - vademecum
          default: vademecum
          description: '"vademecum" o "manual"'
        medicines:
          type: array
          items:
            properties: {}
            x-apidog-orders:
              - 01JFSSRHWJX4XFYX75XAJ9WY3S
            type: object
            x-apidog-refs:
              01JFSSRHWJX4XFYX75XAJ9WY3S: *ref_0
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis:
          type: string
          description: Diagnóstico
        reference:
          type: string
          description: Referencia externa que permite identificar recetas
        doctor:
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
        hiv:
          type: boolean
          description: Si la receta es para VIH, por defecto es false
      required:
        - date
        - patient
        - method
        - medicines
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# prescription

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    baseMedicine:
      type: object
      properties:
        longTerm:
          type: boolean
          description: Tratamiento prolongado
          default: false
        quantity:
          type: number
          description: Cantidad
          minimum: 1
          maximum: 10
        externalId:
          type: string
          description: ExternalId del medicamento (del GET a /medications)
        requiresDuplicate:
          type: boolean
          description: Requiere duplicado
          default: false
        posology:
          type: string
          description: Posología
        genericOnly:
          type: boolean
          description: >-
            Recetar sólo genérico. Si es true, el texto del PDF no incluirá la
            marca. En ese caso, brandRecommendation debe ser false
          default: false
        text:
          type: string
          description: Texto mostrado en el PDF de la receta
        brandRecommendation:
          type: boolean
          description: >-
            Recomendar la marca del medicamento. Si es true, no se permite
            sustitución. En ese caso, genericOnly debe ser false
          default: false
      required:
        - longTerm
        - quantity
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    prescription:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Id de la receta
        externalId:
          type: string
          description: >-
            Si method=vademecum, el número de receta. Es el código de barras del
            PDF
        url:
          type: string
          format: uri
          description: URL al PDF de la receta
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
      x-apidog-orders:
        - id
        - 01HX31XYG91W1Y6E09YZ0P75RQ
        - externalId
        - createdDate
        - url
      required:
        - id
        - url
        - createdDate
      x-apidog-refs:
        01HX31XYG91W1Y6E09YZ0P75RQ:
          $ref: '#/components/schemas/basePrescription'
      x-apidog-folder: ''
    basePrescription:
      type: object
      properties:
        userId:
          type: integer
          description: Id del usuario asociado al médico. No requerido si se envía doctor
          format: int
        date:
          type: string
          description: Fecha a partir de la cual la receta es válida, en formato AAAA-MM-DD
        patient:
          description: Información del paciente
          $ref: '#/components/schemas/patient'
        method:
          type: string
          enum:
            - vademecum
          default: vademecum
          description: '"vademecum" o "manual"'
        medicines:
          type: array
          items:
            properties: {}
            x-apidog-orders:
              - 01JFSSRHWJX4XFYX75XAJ9WY3S
            type: object
            x-apidog-refs:
              01JFSSRHWJX4XFYX75XAJ9WY3S:
                $ref: '#/components/schemas/baseMedicine'
                x-apidog-overrides: {}
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis:
          type: string
          description: Diagnóstico
        reference:
          type: string
          description: Referencia externa que permite identificar recetas
        doctor:
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
        hiv:
          type: boolean
          description: Si la receta es para VIH, por defecto es false
      required:
        - date
        - patient
        - method
        - medicines
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# createdPrescription

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    baseMedicine:
      type: object
      properties:
        longTerm:
          type: boolean
          description: Tratamiento prolongado
          default: false
        quantity:
          type: number
          description: Cantidad
          minimum: 1
          maximum: 10
        externalId:
          type: string
          description: ExternalId del medicamento (del GET a /medications)
        requiresDuplicate:
          type: boolean
          description: Requiere duplicado
          default: false
        posology:
          type: string
          description: Posología
        genericOnly:
          type: boolean
          description: >-
            Recetar sólo genérico. Si es true, el texto del PDF no incluirá la
            marca. En ese caso, brandRecommendation debe ser false
          default: false
        text:
          type: string
          description: Texto mostrado en el PDF de la receta
        brandRecommendation:
          type: boolean
          description: >-
            Recomendar la marca del medicamento. Si es true, no se permite
            sustitución. En ese caso, genericOnly debe ser false
          default: false
      required:
        - longTerm
        - quantity
        - requiresDuplicate
        - text
      x-apidog-orders:
        - externalId
        - quantity
        - longTerm
        - posology
        - requiresDuplicate
        - genericOnly
        - brandRecommendation
        - text
      x-apidog-folder: ''
    createdPrescription:
      type: object
      x-apidog-refs:
        01JD330RMKP2BHHYXFRJ23AYDY:
          $ref: '#/components/schemas/prescription'
          x-apidog-overrides: {}
      properties:
        recurring:
          type: object
          properties:
            id:
              type: number
              description: Id de la receta
            date:
              type: string
              format: date-time
              description: Fecha de creación
            externalId:
              type: string
              description: El número de receta
            url:
              type: string
              description: URL al PDF de la receta
          x-apidog-orders:
            - id
            - date
            - externalId
            - url
          description: Recetas recurrentes
          required:
            - id
            - date
            - externalId
            - url
      x-apidog-orders:
        - 01JD330RMKP2BHHYXFRJ23AYDY
        - recurring
      x-apidog-folder: ''
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    prescription:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Id de la receta
        externalId:
          type: string
          description: >-
            Si method=vademecum, el número de receta. Es el código de barras del
            PDF
        url:
          type: string
          format: uri
          description: URL al PDF de la receta
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
      x-apidog-orders:
        - id
        - 01HX31XYG91W1Y6E09YZ0P75RQ
        - externalId
        - createdDate
        - url
      required:
        - id
        - url
        - createdDate
      x-apidog-refs:
        01HX31XYG91W1Y6E09YZ0P75RQ:
          $ref: '#/components/schemas/basePrescription'
      x-apidog-folder: ''
    basePrescription:
      type: object
      properties:
        userId:
          type: integer
          description: Id del usuario asociado al médico. No requerido si se envía doctor
          format: int
        date:
          type: string
          description: Fecha a partir de la cual la receta es válida, en formato AAAA-MM-DD
        patient:
          description: Información del paciente
          $ref: '#/components/schemas/patient'
        method:
          type: string
          enum:
            - vademecum
          default: vademecum
          description: '"vademecum" o "manual"'
        medicines:
          type: array
          items:
            properties: {}
            x-apidog-orders:
              - 01JFSSRHWJX4XFYX75XAJ9WY3S
            type: object
            x-apidog-refs:
              01JFSSRHWJX4XFYX75XAJ9WY3S:
                $ref: '#/components/schemas/baseMedicine'
                x-apidog-overrides: {}
          maxItems: 3
          description: Medicamentos. Obtenidos a partir del endpoint /medications
        diagnosis:
          type: string
          description: Diagnóstico
        reference:
          type: string
          description: Referencia externa que permite identificar recetas
        doctor:
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
        hiv:
          type: boolean
          description: Si la receta es para VIH, por defecto es false
      required:
        - date
        - patient
        - method
        - medicines
        - diagnosis
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - method
        - medicines
        - diagnosis
        - reference
        - hiv
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# createOrder

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    createOrder:
      type: object
      properties:
        userId:
          type: integer
          format: int64
          description: Id del usuario asociado al médico. No requerido si se envía doctor
        date:
          type: string
          description: Fecha a partir de la cual la órden es válida, en formato AAAA-MM-DD
        medicine:
          type: string
          description: Texto a mostrar en el PDF de la orden.
        diagnosis:
          type: string
          description: Diagnóstico
        patient:
          $ref: '#/components/schemas/patient'
          description: Información del paciente
        reference:
          type: string
          description: Referencia externa que permite identificar órdenes
        doctor:
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
      required:
        - date
        - medicine
        - diagnosis
        - patient
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - medicine
        - diagnosis
        - reference
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# order

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    doctor:
      type: object
      properties:
        email:
          type: string
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        province:
          type: string
          description: Name del endpoint /provinces
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        healthCenterId:
          type: number
          description: >-
            El id de la institución. Obligatorio si se maneja más de una
            institución
        signature:
          type: string
          description: >-
            La firma del médico en base64, idealmente sin fondo y de hasta 300px
            de ancho
        profile:
          $ref: '#/components/schemas/createProfile'
          description: Perfil del usuario
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
        - healthCenterId
        - signature
        - profile
      required:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - province
        - title
        - specialty
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    order:
      type: object
      properties:
        id:
          type: integer
          format: int64
          description: Id de la orden
        url:
          type: string
          format: uri
          description: URL al PDF de la orden
      x-apidog-orders:
        - id
        - url
        - 01HX31YZ94JRHKPERV2PVNEYJW
      required:
        - id
        - url
      x-apidog-refs:
        01HX31YZ94JRHKPERV2PVNEYJW:
          $ref: '#/components/schemas/createOrder'
      x-apidog-folder: ''
    createOrder:
      type: object
      properties:
        userId:
          type: integer
          format: int64
          description: Id del usuario asociado al médico. No requerido si se envía doctor
        date:
          type: string
          description: Fecha a partir de la cual la órden es válida, en formato AAAA-MM-DD
        medicine:
          type: string
          description: Texto a mostrar en el PDF de la orden.
        diagnosis:
          type: string
          description: Diagnóstico
        patient:
          $ref: '#/components/schemas/patient'
          description: Información del paciente
        reference:
          type: string
          description: Referencia externa que permite identificar órdenes
        doctor:
          $ref: '#/components/schemas/doctor'
          description: Información del médico. No requerido si se envía userId
      required:
        - date
        - medicine
        - diagnosis
        - patient
      x-apidog-orders:
        - userId
        - doctor
        - date
        - patient
        - medicine
        - diagnosis
        - reference
      x-apidog-folder: ''
    patient:
      type: object
      properties:
        healthInsurance:
          type: string
          description: >-
            Nombre de la obra social/prepaga. Obtenido del endpoint
            /health-insurances
        insuranceNumber:
          type: string
          description: >-
            Número de afiliado sin caracteres especiales (puntos, guiones o
            barras). Opcional si healthInsurance: "particular"
        name:
          type: string
          description: Nombre
        surname:
          type: string
          description: Apellido
        documentNumber:
          type: string
          description: Número de documento, sin espacios, puntos o guiones
        email:
          type: string
          format: email
          description: Email
          nullable: true
        phone:
          type: string
          description: Teléfono
          nullable: true
        gender:
          type: string
          description: >-
            Género del paciente. "m" si es hombre, "f" si es mujer, "o" si es
            otro
        birthDate:
          type: string
          description: Fecha de nacimiento del paciente en formato "AAAA-MM-DD"
      required:
        - healthInsurance
        - name
        - surname
        - documentNumber
        - birthDate
        - gender
      x-apidog-orders:
        - healthInsurance
        - insuranceNumber
        - name
        - surname
        - documentNumber
        - email
        - phone
        - gender
        - birthDate
      description: Información del paciente
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# createUser

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email:
          type: string
          format: email
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        workPhone:
          type: string
          description: Número de teléfono del consultorio
        address:
          type: string
          description: Dirección del consultorio
        province:
          type: string
          description: Name del endpoint /provinces
        profile:
          $ref: '#/components/schemas/createProfile'
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - profile
        - province
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - email
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# user

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name:
          type: string
        address:
          type: string
          description: Dirección
        phone:
          type: string
          description: Teléfono
        email:
          type: string
          format: email
          description: Email
        logoUrl:
          type: string
          description: URL del logo con un máximo de 250px
        footer:
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion:
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4: &ref_0
          $ref: '#/components/schemas/createProfile'
          x-apidog-overrides: {}
      properties:
        id:
          type: integer
          format: int64
        healthCenter:
          $ref: '#/components/schemas/healthCenter'
      required:
        - id
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
    user:
      type: object
      properties:
        id:
          type: integer
          format: int64
        createdDate:
          type: string
          format: date-time
          description: Fecha de creación
        active:
          type: boolean
          description: >-
            Si el usuario está activo o no. Es necesario que lo esté para poder
            hacer requests en su nombre
      x-apidog-orders:
        - id
        - createdDate
        - 01HX30S0CXHW54JNQKXPAVQ6AV
        - active
      required:
        - id
        - createdDate
        - active
      x-apidog-refs:
        01HX30S0CXHW54JNQKXPAVQ6AV:
          $ref: '#/components/schemas/createUser'
          x-apidog-overrides:
            profile:
              $ref: '#/components/schemas/profile'
          required:
            - profile
      x-apidog-folder: ''
    createUser:
      type: object
      properties:
        email:
          type: string
          format: email
          description: Email del usuario asociado
        name:
          type: string
          description: Nombre del médico
        surname:
          type: string
          description: Apellido del médico
        licenseType:
          type: string
          description: 'Tipo de licencia: "nacional" o "provincial"'
        licenseNumber:
          type: string
          description: Número de licencia
        documentNumber:
          type: string
          description: >-
            Número de documento, sin espacios, puntos o guiones con al menos 6
            dígitos
        title:
          type: string
          description: '"Dr" o "Dra"'
        specialty:
          type: string
          description: Especialidad
        workPhone:
          type: string
          description: Número de teléfono del consultorio
        address:
          type: string
          description: Dirección del consultorio
        province:
          type: string
          description: Name del endpoint /provinces
        profile: *ref_0
      x-apidog-orders:
        - email
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - province
        - profile
      required:
        - profile
        - province
        - name
        - surname
        - licenseType
        - licenseNumber
        - documentNumber
        - title
        - specialty
        - workPhone
        - address
        - email
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# createProfile

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# profile

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name:
          type: string
        address:
          type: string
          description: Dirección
        phone:
          type: string
          description: Teléfono
        email:
          type: string
          format: email
          description: Email
        logoUrl:
          type: string
          description: URL del logo con un máximo de 250px
        footer:
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion:
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
    profile:
      type: object
      x-apidog-refs:
        01HX322XV06SGDF2Y541MHK3C4:
          $ref: '#/components/schemas/createProfile'
          x-apidog-overrides: {}
      properties:
        id:
          type: integer
          format: int64
        healthCenter:
          $ref: '#/components/schemas/healthCenter'
      required:
        - id
        - healthCenter
      x-apidog-orders:
        - id
        - 01HX322XV06SGDF2Y541MHK3C4
        - healthCenter
      x-apidog-folder: ''
    createProfile:
      type: object
      properties:
        legend:
          type: string
          description: Leyenda que se muestra en el PDF debajo del nombre
        phone:
          type: string
          description: Teléfono que se muestra en el PDF
        address:
          type: string
          description: Dirección que se muestra en el PDF
        email:
          type: string
          description: Email que se muestra en el PDF
      x-apidog-orders:
        - legend
        - phone
        - address
        - email
      required:
        - legend
        - phone
        - address
        - email
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# createHealthCenter

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    createHealthCenter:
      type: object
      properties:
        name:
          type: string
        address:
          type: string
          description: Dirección
        phone:
          type: string
          description: Teléfono
        email:
          type: string
          format: email
          description: Email
        logoUrl:
          type: string
          description: URL del logo con un máximo de 250px
        footer:
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion:
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# healthCenter

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    healthCenter:
      type: object
      properties:
        id:
          type: integer
          format: int64
      x-apidog-orders:
        - id
        - 01HX32FZQGDDHNZ9C9MTB7AMWX
      required:
        - id
      x-apidog-refs:
        01HX32FZQGDDHNZ9C9MTB7AMWX:
          $ref: '#/components/schemas/createHealthCenter'
      x-apidog-folder: ''
    createHealthCenter:
      type: object
      properties:
        name:
          type: string
        address:
          type: string
          description: Dirección
        phone:
          type: string
          description: Teléfono
        email:
          type: string
          format: email
          description: Email
        logoUrl:
          type: string
          description: URL del logo con un máximo de 250px
        footer:
          type: string
          description: >-
            HTML custom que se ubica al final de las recetas y órdenes.
            Reemplaza a la fila que contiene la dirección, teléfono y mail.
        pdfVersion:
          type: number
          description: Plantilla para emitir prescripciones y órdenes
          default: 1
          minimum: 1
          maximum: 2
      required:
        - name
        - address
        - phone
        - email
        - logoUrl
      x-apidog-orders:
        - name
        - address
        - phone
        - email
        - logoUrl
        - footer
        - pdfVersion
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# medication

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    medicationPackage:
      type: object
      properties:
        id:
          type: number
          description: Id
        name:
          type: string
          description: Nombre de la presentación
        externalId:
          type: string
          description: Id a utilizar al momento de generar una nueva receta
        shape:
          type: string
          description: Forma farmacéutica
        action:
          type: string
          description: Acción farmacológica
        barcode:
          type: string
          description: Código de barras del producto
        power:
          type: object
          properties:
            value:
              type: string
              description: >-
                Valor de la potencia (ej: "100", "100/200" para medicamentos
                multidroga
            unit:
              type: string
              description: 'Unidad de la potencia (ej: "mg", "mg/5 ml")'
          x-apidog-orders:
            - value
            - unit
          required:
            - value
            - unit
          description: Potencia
      x-apidog-orders:
        - id
        - name
        - externalId
        - shape
        - action
        - barcode
        - power
      description: Presentaciones
      required:
        - id
        - name
        - externalId
      x-apidog-folder: ''
    medication:
      type: object
      properties:
        id:
          type: number
          description: Id
        brand:
          type: string
          description: Marca comercial
        drug:
          type: string
          description: Principio activo
        requiresDuplicate:
          type: boolean
          description: Si requiere duplicado
        hivSpecific:
          type: boolean
          description: Si es específico para VIH
        packages:
          description: Presentaciones
          $ref: '#/components/schemas/medicationPackage'
      x-apidog-orders:
        - id
        - brand
        - drug
        - requiresDuplicate
        - hivSpecific
        - packages
      required:
        - id
        - brand
        - drug
        - requiresDuplicate
        - hivSpecific
        - packages
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```
# medicationPackage

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths: {}
components:
  schemas:
    medicationPackage:
      type: object
      properties:
        id:
          type: number
          description: Id
        name:
          type: string
          description: Nombre de la presentación
        externalId:
          type: string
          description: Id a utilizar al momento de generar una nueva receta
        shape:
          type: string
          description: Forma farmacéutica
        action:
          type: string
          description: Acción farmacológica
        barcode:
          type: string
          description: Código de barras del producto
        power:
          type: object
          properties:
            value:
              type: string
              description: >-
                Valor de la potencia (ej: "100", "100/200" para medicamentos
                multidroga
            unit:
              type: string
              description: 'Unidad de la potencia (ej: "mg", "mg/5 ml")'
          x-apidog-orders:
            - value
            - unit
          required:
            - value
            - unit
          description: Potencia
      x-apidog-orders:
        - id
        - name
        - externalId
        - shape
        - action
        - barcode
        - power
      description: Presentaciones
      required:
        - id
        - name
        - externalId
      x-apidog-folder: ''
  securitySchemes: {}
servers:
  - url: https://external-api.recetario.com.ar
    description: Prod Env
security: []

```

