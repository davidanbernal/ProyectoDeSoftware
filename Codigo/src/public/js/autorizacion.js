
document.addEventListener("DOMContentLoaded", () => {

     // Cargar oficinas en el select al abrir la página
  (async () => {
    const selectOficina = document.getElementById("oficina");
    if (!selectOficina) return;

    try {
      const resp = await fetch("/oficinas");
      const json = await resp.json();

      if (!json.success || !Array.isArray(json.data)) {
        alert(json.message || "No fue posible cargar las oficinas.");
        return;
      }

      // Limpia todo y deja el placeholder
      selectOficina.innerHTML = '<option value="">Seleccione oficina</option>';

      // Carga opciones desde BD
      json.data.forEach((o) => {
        const opt = document.createElement("option");
        // Guardamos el valor visible (101, 102...) 
        opt.value = String(o.oficina);
        opt.textContent = String(o.oficina);
        selectOficina.appendChild(opt);
      });

    } catch (e) {
      console.error(e);
      alert("Error al cargar las oficinas. Intente nuevamente.");
    }
  })();

  //  botón Autorizar 
    const btnAutorizar = document.getElementById("btnAutorizar");
  
    btnAutorizar.addEventListener("click", async () => {
  
      const oficina = document.getElementById("oficina").value.trim();
      const autoriza = document.getElementById("autoriza").value.trim();
      const contrasena = document.getElementById("clave").value.trim();
      const fecha = document.getElementById("fecha").value;
      const identificacion = document.getElementById("identificacion").value.trim();
  
      if (!oficina || !autoriza || !contrasena || !fecha || !identificacion) {
        alert("Por favor complete todos los campos antes de autorizar.");
        return;
      }
  
      // 🔒 Validación de fecha (hoy o posterior)
      const hoy = new Date();
      const fechaHoy =
        hoy.getFullYear() + "-" +
        String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
        String(hoy.getDate()).padStart(2, "0");
      
      //console.log("Fecha ingresada:", fecha);
      //console.log("Fecha hoy:", fechaHoy);
      
      
      if (fecha !== "" && fecha < fechaHoy) {
        alert("La fecha de ingreso debe ser hoy o una fecha posterior.");
        return;
      }
  
      let data;
      try {
        const respuesta = await fetch("/autorizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oficina, autoriza, contrasena, fecha, identificacion }),
        });
  
        data = await respuesta.json();
      } catch (error) {
        console.error(error);
        alert("Error al comunicarse con el servidor. Intente nuevamente.");
        return;
      }
  
      alert(data.message || "Respuesta del servidor sin mensaje.");
  
      if (data.success) {
        const form = document.getElementById("formAutorizacion") || document.querySelector("form");
        if (form) form.reset();
      }
  
    });
  
  });
  