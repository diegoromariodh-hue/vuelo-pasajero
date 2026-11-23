# Vuelo Passenger V4

Agrega:
- ¿Olvidaste tu contraseña?
- Recuperación por correo con Supabase Auth.
- Pantalla /reset-password para crear nueva contraseña.
- Mensaje de soporte por correo: soporte@vuelonicaragua.online
- Sincronización de usuarios Auth con profiles.
- Mantiene mejoras de V3.

## Instalar
npm install
npm run dev

## Variables
Copia .env.example a .env

Para local:
VITE_APP_URL=http://localhost:5173

Para producción:
VITE_APP_URL=https://TU-DOMINIO-DE-PASAJERO

## SQL
Ejecuta SUPABASE_PASSENGER_V4_SQL.sql en Supabase SQL Editor.

## Supabase Auth URL Configuration
Agrega en Redirect URLs:
http://localhost:5173/reset-password
https://TU-DOMINIO-DE-PASAJERO/reset-password
