document.addEventListener("DOMContentLoaded", () => {
  const inputId = document.getElementById("id_visitante");
  const btnBuscar = document.getElementById("btnBuscar");

  const inputAutoriza = document.getElementById("autoriza");
  const inputFecha = document.getElementById("fecha_ingreso");
  const inputOficina = document.getElementById("oficina");
  const inputNombres = document.getElementById("nombres");

  const formRegistro = document.getElementById("formRegistro");
  const btnRegistrar = document.getElementById("btnRegistrar");

  // Guardamos el ID del registro de autorización encontrado
  let visitanteRegistroId = null;

  function limpiarCampos() {
    inputAutoriza.value = "";
    inputFecha.value = "";
    inputOficina.value = "";
    inputNombres.value = "";
    inputNombres.disabled = true;
    btnRegistrar.disabled = true;
    visitanteRegistroId = null;
  }

  // Habilitar Registrar solo si hay búsqueda exitosa y nombres no vacío
  inputNombres.addEventListener("input", () => {
    const nombresOk = inputNombres.value.trim().length > 0;
    btnRegistrar.disabled = !(visitanteRegistroId && nombresOk);
  });

  btnBuscar.addEventListener("click", async () => {
    const identificacion = (inputId.value || "").trim();

    if (!identificacion) {
      alert("Por favor ingrese el número de identificación antes de buscar.");
      limpiarCampos();
      return;
    }

    limpiarCampos();

    try {
      // Fecha de hoy en formato YYYY-MM-DD (local, sin zona horaria)
      const hoy = new Date();
      const fechaHoy =
        hoy.getFullYear() + "-" +
        String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
        String(hoy.getDate()).padStart(2, "0");

      const resp = await fetch(
        `/busqueda?identificacion=${encodeURIComponent(identificacion)}&fecha=${encodeURIComponent(fechaHoy)}`
      );

      const data = await resp.json();

      if (!data.success) {
        alert(data.message || "No hay autorización asociada a ese número de identificación.");
        return;
      }

      // Llenar campos
      visitanteRegistroId = data.data.id; // id del registro en visitantes
      inputAutoriza.value = data.data.autorizo_nombre || "";
      inputOficina.value = data.data.oficina || "";
      inputFecha.value = data.data.fecha_ingreso_autorizado
      ? data.data.fecha_ingreso_autorizado.toString().substring(0, 10)
      : "";

      // Habilitar campo nombres para que el usuario lo diligencie
      inputNombres.disabled = false;
      inputNombres.focus();

      // Registrar queda habilitado solo cuando nombres tenga texto (listener input)
    } catch (e) {
      console.error(e);
      alert("Error al comunicarse con el servidor. Intente nuevamente.");
    }
  });

  // Registrar: actualiza nombre y hora_ingreso
  formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identificacion = (inputId.value || "").trim();
    const nombres = (inputNombres.value || "").trim();

    if (!visitanteRegistroId) {
      alert("Primero debe realizar una búsqueda exitosa.");
      return;
    }

    if (!nombres) {
      alert("Por favor diligencie Nombres y Apellidos.");
      return;
    }

    try {
      const resp = await fetch("/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: visitanteRegistroId,
          identificacion,
          nombre: nombres
        })
      });

      const data = await resp.json();

      alert(data.message || "Respuesta del servidor sin mensaje.");

      if (data.success) {
        // Reset UI
        inputId.value = "";
        limpiarCampos();
      }
    } catch (e) {
      console.error(e);
      alert("Error al comunicarse con el servidor. Intente nuevamente.");
    }
  });
});
