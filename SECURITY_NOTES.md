# Seguridad revisada en Vuelo Passenger V3

## Mejoras aplicadas

- La app solo lee columnas necesarias del perfil.
- La app no consulta campos internos de publicidad como `price` o `paid`.
- RLS para `platform_ads`:
  - El público solo puede leer anuncios activos, vigentes y en placement `passenger_home`.
  - Solo roles internos pueden gestionar anuncios.
- RLS para `platform_settings`:
  - El público puede leer mensajes y comisión.
  - Solo roles internos pueden editar.
- RLS recomendado para `rides`:
  - Pasajero solo crea viajes con su propio `auth.uid()`.
  - Pasajero solo lee/actualiza sus propios viajes.
- RLS recomendado para `ride_offers`:
  - Pasajero solo ve/actualiza ofertas de sus propios viajes.
- Si `profiles.is_active = false`, la app bloquea el acceso.
- El mensaje fuera de cobertura solo aparece cuando el usuario ya comenzó a ingresar ubicación.

## Pendiente para próximas versiones
- Push notifications reales.
- Validación geográfica por coordenadas reales de Ometepe.
- Sanitizar/validar enlaces de anuncios desde SuperAdmin.
- Auditoría de acciones administrativas.
