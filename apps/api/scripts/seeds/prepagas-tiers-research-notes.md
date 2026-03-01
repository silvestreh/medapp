# Prepagas tiers research notes

Research date: February 2026. Internet searches were run for insurers in `prepagas.json` to find plan tiers (niveles/planes).

## Updates applied

- **OSDE**: Extended with "030" and "Flux" (was 210, 310, 410, 450, 510).
- **SPS** (Sistemas Privados de Salud): Added ["Plan Oro", "Plan Plata Especial", "Plan Joven"].
- **Salud Integral**: Added ["Plan Más Salud"].
- **OSPECON** (Construir Salud): Added Mi 500–Mi 2000 Plus tiers.
- **Medicina Esencial**: Extended with Plan Ahorro, Platino, Plata, MTA, Plan E, Grupo Oroño.

## Insurers with no tiers found (empty tiers left as [])

Searches were run for a sample of insurers; many returned no public tier/plan names. These include small mutuales, regional prepagas, and obras sociales that do not publish named plan levels (e.g. single PMO-based coverage). Examples: Aczep, OSPU, EME, Sanatorio Garay, Nativus, Delta Salud, Plus Salud, Hogar Salud, Germed, Medvisur, Conurbano Salud, Family Salud, Your Health, Cen Salud, Emme, Instituto Panamericano, Intermed, Simara (confused with SIM cards), Corporación Asistencial (only “Planes a tu medida” mentioned), OSPEP, OSPIC, and most union/employer obras sociales.

## Sources used

### By insurer (updates applied)

- **OSDE**  
  - https://www.centralab.com.ar/eng/osde-plan-flux/  
  - https://www.centralab.com.ar/eng/osde-plan-210/  
  - https://www.osde.com.ar/ (planes / asociarme-a-osde)

- **SPS (Sistemas Privados de Salud)**  
  - https://spssalud.com.ar/planes.html

- **Salud Integral**  
  - https://www.saludintegralweb.com/prepaga

- **OSPECON (Construir Salud)**  
  - https://construirsalud.com.ar/  
  - https://www.miobrasocial.com.ar/obras-sociales/construir-salud/  
  - https://ospoceintegral.com.ar/planes/ (plan names Mi 500–Mi 2000 Plus)

- **Medicina Esencial**  
  - https://medicinaesencial.com.ar/planes

### General

- Web search queries: `"{insurer}" prepaga Argentina planes`, `"{insurer}" obra social planes cobertura`, and variants.
- **Superintendencia de Servicios de Salud (SSS)**  
  - https://www.argentina.gob.ar/sssalud/valores-de-planes  
  - https://www.argentina.gob.ar/sssalud/valores-historicos-de-los-planes-de-prepagas
- **Comparators / info**  
  - https://www.elegimejor.com.ar/  
  - https://www.miobrasocial.com.ar/

### Cuadros Tarifarios (SSS) – official plan/price table

- **URL**: [https://cuadrostarifarios.sssalud.gob.ar/](https://cuadrostarifarios.sssalud.gob.ar/)
- Opened in a Cursor browser tab and inspected. The site shows a table of plans declared by each Entidad de Medicina Prepaga (EMP), in line with Resolución Nº645/2025.
- **Table columns**: Período, Rnemp, Descripción Rnemp, Tipificación, Plan, Región, Valor de lista, Rango Etario, Tasa Aumento, Con Copago.
- **Use for tiers**: “Descripción Rnemp” is the prepaga/insurer name; “Plan” is the plan/tier name. Example row: Descripción Rnemp = “UNION PERSONAL (OBRA SOCIAL)”, Plan = “ACCORD 2.2”.
- **Data loading**: Content is loaded dynamically (filters: Período, Rnemp/prepaga, Región, Rango Etario, Plan, Tipificación, Modalidad). No public API or CSV/Excel download was found; `/api/*` paths returned 404.
- **Bulk extraction**: To get all prepaga → plan names from this site you’d need browser automation (e.g. Playwright/Puppeteer): open the page, wait for “Cargando prepagas…” to finish, then either scrape the table or iterate filters and read the table rows.

## Recommendation

For insurers still with empty `tiers`, consider: (1) checking [cuadrostarifarios.sssalud.gob.ar](https://cuadrostarifarios.sssalud.gob.ar/) or [argentina.gob.ar/sssalud/valores-de-planes](https://www.argentina.gob.ar/sssalud/valores-de-planes) for plan names by prepaga; (2) contacting the entity directly; or (3) leaving as `[]` when the entity has a single plan or no published tier structure.
