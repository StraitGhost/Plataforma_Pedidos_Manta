# Guía: reservas y readiness

1. Abrir `Plataforma_Pedidos_Manta` en VS Code. Los Dockerfile se llaman exactamente `Dockerfile` (D mayúscula), como espera Docker.
2. Verificar Docker Desktop encendido. En una terminal situada junto a `compose.yaml`: `docker compose down` y `docker compose up --build -d`.
3. Comprobar con `docker compose ps` que ambos servicios se ejecutan.
4. En Postman ejecutar **dos veces** `POST http://localhost:3000/pedidos` con body **raw JSON**: `{"sku":"MOUSE-USB","cantidad":30}`. Captura 1: respuestas 201 y 409 (si se hacen en dos ventanas o requests, muestra las dos).
5. Hacer `GET http://localhost:3001/stock/MOUSE-USB`: debe mostrar `{"sku":"MOUSE-USB","disponible":10}`. Captura 2.
6. Hacer `GET http://localhost:3000/health` y `GET http://localhost:3000/health/ready`: ambos 200 (el segundo responde JSON). Captura 3.
7. En terminal: `docker compose stop inventario`. Repetir los dos GET de salud de Pedidos: /health es 200 y /health/ready es 503 con motivo. Captura 4.
8. En documento Word (o Docs), insertar las cuatro capturas con una línea bajo cada una explicando la prueba; exportar como PDF.
9. Para reiniciar: `docker compose down` seguido de `docker compose up --build -d` (el stock vuelve a 40 porque es memoria). Para detener: `docker compose down`.

Notas: el código conserva los productos originales de Inventario y añade MOUSE-USB con stock 40. Respuestas de la reserva en Inventario: 200 si reserva, 400 cantidad inválida, 404 SKU inexistente, 409 stock insuficiente. Si se quiere ver qué ocurre en la reserva directamente: `POST http://localhost:3001/stock/MOUSE-USB/reservar`, body `{"cantidad":3}`.
