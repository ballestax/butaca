# Butaca

Recomendador de películas y series. Califica lo que ya viste, marca lo que no, y el
motor arma un perfil con los géneros y temas que se repiten en lo que te gusta para
ordenar el resto por afinidad. Los datos y los pósters vienen de TMDB.

## Arrancar

```bash
npm install
cp .env.example .env     # pega tu TMDB_API_KEY
npm run dev              # http://localhost:5173
```

La key gratuita se pide en <https://www.themoviedb.org/settings/api> (tipo "Developer",
aprobación inmediata).

## Dónde vive la key

El navegador nunca la ve. Llama a `/tmdb/...` y el proxy la añade:

- en desarrollo, el proxy de `vite.config.js`;
- en producción, la función `api/tmdb.js` más la reescritura de `vercel.json`.

Para desplegar en Vercel: `vercel` y añade `TMDB_API_KEY` en las variables del proyecto.

## Cómo recomienda

1. **Perfil.** Cada título calificado aporta sus etiquetas (géneros + palabras clave de
   TMDB) con un peso según las estrellas: 5 suma 1, 1 resta 1, 3 es casi neutro. Lo que
   no te gustó empuja en contra, que es la mitad de la señal.
2. **Temporadas.** Una serie abandonada en la T2 de 5 cuenta con un factor de 0,6 a 1
   según cuánto viste. Dejarla a medias también dice algo.
3. **Candidatos.** El catálogo popular de TMDB más los `recommendations` de tus favoritas,
   que es donde la API aporta títulos que no están en ninguna lista general.
4. **Orden.** Afinidad coseno entre el perfil y las etiquetas de cada candidato, mostrada
   como porcentaje, con la razón concreta ("porque te gustó X: ciencia ficción y distopía").

Todo el motor está en `src/recomendador.js`, sin dependencias, para que puedas cambiar los
pesos sin tocar la interfaz.

## Estructura

```
src/api.js            cliente de TMDB (catálogo, detalle, similares, búsqueda)
src/recomendador.js   perfil, afinidad, razón
src/App.jsx           estado, pestañas, búsqueda, persistencia en localStorage
src/components/       Ficha (póster, estrellas, temporadas) y Perfil
api/tmdb.js           proxy de producción
```

## Siguientes pasos

- Guardar las calificaciones en una cuenta en vez de `localStorage`.
- Filtro por servicio de streaming con `/watch/providers` de TMDB.
- Afinar el peso de las palabras clave frente a los géneros (ahora valen igual).

Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
