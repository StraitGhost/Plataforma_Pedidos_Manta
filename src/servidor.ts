
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);

app.get("/", (_req: Request, res: Response) => {
    res.send("saludos desde un get usando libreria Express");
});

// Catálogo de 5 productos
const productos = [
    { id: 1, nombre: "Laptop HP", precio: 750, stock: 10 },
    { id: 2, nombre: "Mouse Logitech", precio: 25, stock: 30 },
    { id: 3, nombre: "Teclado Redragon", precio: 45, stock: 15 },
    { id: 4, nombre: "Monitor Samsung", precio: 200, stock: 8 },
    { id: 5, nombre: "Audífonos Sony", precio: 80, stock: 20 }
];

// GET: Obtener todos los productos
app.get("/productos", (_req: Request, res: Response) => {
    res.json(productos);
});

// POST: Agregar un nuevo producto
app.post("/productos", (req: Request, res: Response) => {
    const nuevoProducto = req.body;

    // Validar los datos del producto
    if (
        typeof nuevoProducto?.id !== "number" ||
        typeof nuevoProducto?.nombre !== "string" ||
        typeof nuevoProducto?.precio !== "number" ||
        typeof nuevoProducto?.stock !== "number"
    ) {
        res.status(400).json({
            mensaje: "Datos del producto incorrectos"
        });
        return;
    }

    // Comprobar si el ID ya existe
    const productoExistente = productos.find(
        producto => producto.id === nuevoProducto.id
    );

    if (productoExistente) {
        res.status(409).json({
            mensaje: "Ya existe un producto con ese ID"
        });
        return;
    }

    // Agregar el producto
    productos.push(nuevoProducto);

    res.status(201).json({
        mensaje: "Producto agregado correctamente",
        producto: nuevoProducto
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`servidor escuchando en el puerto ${PORT}`);
});
