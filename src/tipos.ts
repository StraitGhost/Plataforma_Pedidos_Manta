//Tipos de datos
const tienda: string = "Manta";
const iva: number = 0.12;
const test: boolean = true;

//Interdaz
interface Persona {
    nombre: string;
    apellido: string;
    edad: number;
    cedula: number;
    ciudad: string;
    sexo: string;
}

const estudiante : Persona [] = [
    {
    nombre : "Juan",
    apellido : "Rovayo",
    edad : 20,
    cedula : 1316133337,
    ciudad : "Quito",
    sexo : "M"
},    {
    nombre : "Juana",
    apellido : "Perez",
    edad : 22,
    cedula : 12355636,
    ciudad : "Quito",
    sexo : "F"
}, 
]

//Buscar
function buscar (cedula: number): Persona | undefined {
    return estudiante.find((p) => p.cedula === cedula);
}

//Filtros
const filtroMasculino  =estudiante.filter((p) => p.sexo === "M");

//
const apellidos = estudiante.map((p) => p.apellido);

console.log("Estudiantes Masculinos:", filtroMasculino);

console.log("Apellido de los estudiantes:", apellidos);

console.log("Buscar por cédula ", buscar(1316133337));