export const content = {
  nav: {
    logo: 'Athelas',
    links: [
      { label: 'Funcionalidades', href: '/#funcionalidades' },
      { label: 'Cómo funciona', href: '/#como-funciona' },
      { label: 'Seguridad', href: '/#seguridad' },
      { label: 'Precios', href: '/#precios' },
    ],
    login: 'Iniciar sesión',
    loginHref: 'https://app.athel.as/',
    cta: 'Comenzar',
    ctaHref: 'https://app.athel.as/',
  },

  hero: {
    badge: 'Plataforma médica moderna',
    headline: 'Software clínico seguro,\nconstruido con confianza',
    subheadline:
      'Athelas potencia consultorios médicos modernos con firma digital, verificación automatizada y flujos asistidos por IA — todo protegido con seguridad de nivel empresarial.',
    cta: 'Agendar demo',
    ctaHref: 'mailto:sales@athel.as',
  },

  features: {
    badge: 'Funcionalidades',
    headline: 'Todo lo que tu consultorio necesita',
    items: [
      {
        title: 'Verificación de identidad y matrícula',
        description:
          'Verificación automática de identidad y matrícula médica. Cada profesional en tu plataforma está debidamente acreditado.',
        icon: 'shield-check',
      },
      {
        title: 'Recetas digitales',
        description:
          'Creá, firmá y enviá recetas de forma digital. Firma digital legalmente válida integrada en el flujo de trabajo.',
        icon: 'prescription',
      },
      {
        title: 'Asistente clínico con IA',
        description:
          'Un asistente inteligente que ayuda con notas de consulta, soporte de decisiones clínicas y documentación. Privacy-first: solo accede a datos anonimizados, nunca a información identificable del paciente.',
        icon: 'brain',
      },
      {
        title: 'Firma digital',
        description:
          'Firma electrónica legalmente válida según la Ley 25.506 para recetas, consentimientos y documentos clínicos. Invisible y auditada.',
        icon: 'signature',
      },
      {
        title: 'Turnos y autogestión',
        description:
          'Gestión inteligente de turnos con autogestión para pacientes. Eligen horarios, cancelan y reprograman desde su celular, sin llamar.',
        icon: 'calendar-check',
      },
      {
        title: 'Comunicación interna',
        description:
          'Mensajería segura entre profesionales, personal y áreas. Mantené tus comunicaciones clínicas en un solo lugar protegido.',
        icon: 'chats-circle',
      },
      {
        title: 'Integración con WhatsApp',
        description:
          'Enviá recetas, recordatorios de turnos y notificaciones por WhatsApp. Reducí el ausentismo y mantené a tus pacientes informados.',
        icon: 'whatsapp-logo',
      },
    ],
  },

  howItWorks: {
    badge: 'Cómo funciona',
    headline: 'Tres pasos hacia una mejor atención',
    steps: [
      {
        number: '01',
        title: 'Verificá tu equipo',
        description:
          'Incorporá profesionales con verificación automática de identidad y matrícula médica. Las credenciales se validan en tiempo real.',
      },
      {
        number: '02',
        title: 'Configurá tu consultorio',
        description:
          'Configurá formularios de consulta, turnos con autogestión para pacientes, firma digital y canales de comunicación del equipo.',
      },
      {
        number: '03',
        title: 'Empezá a atender',
        description:
          'Tu asistente de IA se encarga de la documentación mientras vos te enfocás en la atención. Las recetas se firman y envían digitalmente.',
      },
    ],
  },

  security: {
    badge: 'Seguridad',
    headline: 'Protección de nivel empresarial,\ndesde el primer día',
    subheadline:
      'Cada capa del sistema está diseñada para proteger la información clínica de tus pacientes.',
    items: [
      {
        title: '2FA y Passkeys',
        description:
          'Autenticación multifactor con TOTP y llaves de seguridad WebAuthn. Tus credenciales nunca salen del dispositivo.',
        icon: 'fingerprint',
      },
      {
        title: 'Cifrado AES-256',
        description:
          'Datos sensibles cifrados a nivel de campo con AES-256. Archivos protegidos con AES-256-GCM y verificación de integridad.',
        icon: 'lock-key',
      },
      {
        title: 'Registros inmutables',
        description:
          'Cada encuentro médico se enlaza con un hash SHA-256 al anterior, formando una cadena inalterable. Cualquier manipulación se detecta al instante.',
        icon: 'link-simple',
      },
      {
        title: 'Firma digital certificada',
        description:
          'Documentos firmados con certificados PKCS#12 y firmas CAdES. Verificación de autenticidad e integridad incluida.',
        icon: 'signature',
      },
      {
        title: 'Control de acceso granular',
        description:
          'Permisos por rol, organización y campo. Registro de auditoría de cada acceso a datos sensibles con identificación de dispositivo.',
        icon: 'shield-check',
      },
      {
        title: 'Verificación de identidad',
        description:
          'Validación automática de matrícula contra registros de SSSalud. Verificación de identidad con documento y selfie antes de operar.',
        icon: 'identification-card',
      },
    ],
  },

  testimonial: {
    quote:
      '\u201CAthelas nos dio recetas digitales, verificación automatizada y un asistente de IA que realmente entiende el contexto clínico.\u201D',
    author: 'Dr. Juan Carlos Herrera',
    role: 'Director, Hematología Herrera',
  },

  metrics: [
    { value: '60%', label: 'Menos tiempo documentando' },
    { value: '100%', label: 'Cumplimiento de firma digital' },
    { value: '< 30s', label: 'Verificación de matrícula' },
  ],

  pricing: {
    badge: 'Precios',
    headline: 'Planes simples, sin sorpresas',
    plans: [
      {
        name: 'Solo',
        price: 'US$50',
        period: '/mes',
        description:
          'Para profesionales independientes que quieren digitalizar su práctica.',
        features: [
          '1 profesional + staff ilimitado',
          'Recetas digitales con firma',
          'Verificación de identidad y matrícula',
          'Turnos con autogestión',
          'Cumplimiento Ley 25.506',
        ],
        popular: false,
      },
      {
        name: 'Consultorio',
        price: 'US$120',
        period: '/mes',
        description:
          'Para clínicas en crecimiento. +US$20/mes por profesional adicional.',
        features: [
          '3 profesionales + staff ilimitado',
          'Todo lo del plan Solo',
          'Asistente clínico con IA',
          'Mensajería interna segura',
          'Formularios personalizados',
          'Soporte prioritario',
        ],
        popular: true,
      },
    ],
  },

  cta: {
    headline: '¿List@ para modernizar\ntu consultorio?',
    subheadline:
      'Seguro, conforme a la legislación argentina, y diseñado para cómo funciona la medicina hoy.',
    cta: 'Hablar con ventas',
    ctaHref: 'mailto:sales@athel.as',
  },

  footer: {
    tagline: 'Software médico moderno\npara consultorios modernos.',
    columns: [
      {
        title: 'Producto',
        links: [
          { label: 'Funcionalidades', href: '/#funcionalidades' },
          { label: 'Cómo funciona', href: '/#como-funciona' },
          { label: 'Precios', href: '/#precios' },
        ],
      },
      {
        title: 'Empresa',
        links: [
          { label: 'Nosotros', href: '#' },
          { label: 'Trabajá con nosotros', href: '#' },
          { label: 'Contacto', href: 'mailto:sales@athel.as' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Privacidad', href: '/privacidad' },
          { label: 'Términos', href: '/terminos' },
          { label: 'Ley 25.506', href: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/70000-74999/70749/norma.htm' },
        ],
      },
    ],
    copyright: '2026 Athelas. Todos los derechos reservados.',
    madeIn: 'Hecho con cuidado en Chubut',
  },
} as const;
