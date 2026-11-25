# Bosqueadores Web v0.6.1
Portal manual sin EXE, agente ni instalación. Vercel Hobby + Blob privado + Neon. No incluye saves reales ni credenciales.

## Despliegue
Crea un repositorio privado y sube el contenido de este ZIP a la raíz. Importa en Vercel (Other, Node 22, output public; vercel.json configura build). Crea y conecta Blob **Private** y Neon PostgreSQL. Ejecuta schema.sql en Neon. Variables de producción: DATABASE_URL, BLOB_READ_WRITE_TOKEN, ADMIN_KEY y GROUP_KEY (dos códigos aleatorios distintos (preferiblemente largos)). Redeploy. GET /api/room?action=health debe devolver ok:true. La tabla bosque_web_room es nueva; no migra automáticamente una v0.4. Si ya hay una versión anterior, conserva backups y publica el último mundo manualmente.

## Uso
1. Administrador entra con ADMIN_KEY y su nombre, sube el SaveData.zip host inicial. Descarga la ranura invitado. Extrae directamente en su carpeta Steam ID. Respalda fuera de Saves las otras ranuras del mismo GameID.
2. Nuevo host entra con GROUP_KEY y su nombre; sube su SaveData.zip de MultiplayerClient. Descarga el ZIP y extrae el ZIP directamente en su carpeta Steam ID. Aparta ranuras host antiguas del mismo mundo (no borres otros mundos). Carga la nueva ranura dentro de SOTF.
3. Guarda y cierra el juego. Publica el SaveData.zip de esa nueva ranura desde el mismo navegador y perfil. La publicación libera el host y devuelve la ranura invitado. Extrae directamente en su carpeta Steam ID. Los jugadores que nunca hostean guardan dentro de SOTF normalmente.
4. Si se pierde la descarga, botón Reintentar descarga (solo última publicación y mismo token); también puedes convertir tu save host local sin publicar. Si una sesión quedó bloqueada, el host o admin puede liberarla explícitamente, solo cuando nadie esté jugando.

Ruta: %USERPROFILE%\AppData\LocalLow\Endnight\SonsOfTheForest\Saves\<SteamID>\Multiplayer o MultiplayerClient. El portal admite SaveData.zip directo o un ZIP que contenga exactamente un SaveData.zip. Los ZIP descargados contienen Multiplayer o MultiplayerClient, una carpeta numerada y archivo .name, no extraigas el ZIP interno.

## Seguridad y límites
GameID fijo, validación CRC y tamaño, Blob privado, 10 versiones, reserva atómica SQL, comprobación de sesión y versión base en publicación. El código compartido da acceso a la conversión; los nombres son declarativos, no identidades verificadas. El token de sesión vive en almacenamiento local del navegador; no lo borres durante una partida. No hay detección del juego ni sincronización automática. El control de sesión no puede impedir hostear fuera de la web. La comprobación SaveTime no prueba procedencia: sube siempre la ranura generada y actualizada. Máximo 3 MiB comprimidos, 64 MiB descomprimidos. La conversión replica el algoritmo previo, no garantiza todos los flags individuales de historia; prueba inventario, posición, historia y reconocimiento del GameID en SOTF antes de usarlo sin respaldo. No se ha probado Vercel real ni dependencias de producción en este entorno. No se ha probado la interfaz en navegador. Los tests simulan SQL/Blob. No se reutiliza código de SOTFEdit.

## Pruebas
npm run verify. Para comprobar archivos propios, establece HOST_SAVE y CLIENT_SAVE apuntando a ZIP de ejemplo reales; no se incluyen en el repo. PRUEBAS.txt contiene el resultado local.

## Actualizar desde v0.5
Reemplaza los archivos del repositorio y haz commit/push. No cambies las variables ni ejecutes SQL de nuevo. Las descargas v0.6 se extraen en Steam ID, no dentro de Multiplayer ni MultiplayerClient.

## v0.6.1 — Continuar como host
El último host puede reservar otra sesión con el mismo nombre y el SaveData.zip exacto publicado, sin descargar otra ranura. Si ya jugó sin reservar, el administrador puede publicar manualmente cuando no haya host activo, confirmando que es la continuación del último mundo. La comparación de fecha no demuestra procedencia y los nombres no autentican identidades; usa el grupo de confianza. No cambia el esquema SQL ni las variables.
