document.addEventListener('DOMContentLoaded', () => {
    // Inicializar jsPDF (asumiendo que está cargado globalmente desde el CDN)
    const { jsPDF } = window.jspdf;

    // --- ELEMENTOS DEL DOM ---
    const balanceActualEl = document.getElementById('balance-actual');
    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const ingresosMesEl = document.getElementById('ingresos-mes');
    const gastosMesEl = document.getElementById('gastos-mes');
    const balanceMesEl = document.getElementById('balance-mes');
    const categoriasResumenMesEl = document.getElementById('categorias-resumen-mes');
    const graficoCategoriasMesCtx = document.getElementById('grafico-categorias-mes')?.getContext('2d');
    const ingresosAnoEl = document.getElementById('ingresos-ano');
    const gastosAnoEl = document.getElementById('gastos-ano');
    const balanceAnoEl = document.getElementById('balance-ano');
    const categoriasResumenAnoEl = document.getElementById('categorias-resumen-ano');
    const graficoCategoriasAnoCtx = document.getElementById('grafico-categorias-ano')?.getContext('2d');
    const listaTransaccionesEl = document.getElementById('lista-transacciones');
    const formTransaccion = document.getElementById('form-transaccion');
    const fechaInput = document.getElementById('fecha');
    const descripcionInput = document.getElementById('descripcion');
    const montoInput = document.getElementById('monto');
    const categoriaSelect = document.getElementById('categoria');
    const tipoIngresoRadio = document.getElementById('tipo-ingreso');
    const tipoGastoRadio = document.getElementById('tipo-gasto');
    const formTitleEl = document.getElementById('form-title');
    const transaccionIdInput = document.getElementById('transaccion-id');
    const submitBtn = document.getElementById('submit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const seleccionarTodasBtn = document.getElementById('seleccionar-todas-btn');
    const deseleccionarTodasBtn = document.getElementById('deseleccionar-todas-btn');
    const descargarPdfBtn = document.getElementById('descargar-pdf-btn');
    const currentYearSpan = document.getElementById('current-year');

    if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    if(fechaInput) fechaInput.valueAsDate = new Date();

    let transacciones = JSON.parse(localStorage.getItem('transaccionesPRO_PWA_v1')) || []; // NUEVA CLAVE localStorage para PWA
    let graficoMes = null;
    let graficoAno = null;
    let modoEdicion = false;

    const categoriasBase = {
        ingreso: ["Salario", "Bonificaciones", "Inversiones", "Regalos Recibidos", "Ventas", "Servicios Prestados", "Otros Ingresos"],
        gasto: ["Comida", "Transporte", "Ocio", "Hogar", "Salud", "Ropa", "Educación", "Facturas", "Compras", "Regalos Hechos", "Otros Gastos"]
    };
    const misDatosEmpresa = {
        nombre: "Sialweb",
        direccion: "Av. Guerrita 5, Córdoba, 14005",
        nif: "30980161N", 
        email: "info@sialweb.com",
        web: "www.sialweb.com" 
    };

    const formatearMoneda = (numero) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(numero);
    const formatearFechaParaDisplay = (dateString) => {
        if (!dateString) return "Fecha inválida";
        const fecha = new Date(dateString);
        const offset = fecha.getTimezoneOffset();
        const fechaCorregida = new Date(fecha.valueOf() + offset * 60 * 1000);
        return isNaN(fechaCorregida.getTime()) ? "Fecha inválida" : fechaCorregida.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const generarID = () => Date.now() + Math.floor(Math.random() * 1000);

    function popularCategorias(tipoSeleccionado = null, categoriaASeleccionar = null) {
        const tipo = tipoSeleccionado || (tipoIngresoRadio && tipoIngresoRadio.checked ? 'ingreso' : 'gasto');
        const categoriasParaTipo = categoriasBase[tipo] || [];
        
        if(!categoriaSelect) return;
        categoriaSelect.innerHTML = '<option value="" disabled>Selecciona una categoría...</option>';
        
        categoriasParaTipo.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            if (cat === categoriaASeleccionar) option.selected = true;
            categoriaSelect.appendChild(option);
        });

        if (!categoriaASeleccionar && categoriaSelect.options.length > 0 && categoriaSelect.selectedIndex <= 0) {
             categoriaSelect.selectedIndex = 0;
        }
    }

    if(tipoIngresoRadio) tipoIngresoRadio.addEventListener('change', () => popularCategorias('ingreso'));
    if(tipoGastoRadio) tipoGastoRadio.addEventListener('change', () => popularCategorias('gasto'));

    function resetearFormulario() {
        if(formTransaccion) formTransaccion.reset();
        if(fechaInput) fechaInput.valueAsDate = new Date();
        if(tipoIngresoRadio && tipoIngresoRadio.defaultChecked) tipoIngresoRadio.checked = true;
        else if (tipoGastoRadio && tipoGastoRadio.defaultChecked) tipoGastoRadio.checked = true;
        else if (tipoIngresoRadio) tipoIngresoRadio.checked = true;

        popularCategorias(tipoIngresoRadio.checked ? 'ingreso' : 'gasto');
        
        if(transaccionIdInput) transaccionIdInput.value = '';
        if(formTitleEl) formTitleEl.textContent = 'Añadir Nueva Transacción';
        if(submitBtn) submitBtn.textContent = 'Añadir Transacción';
        if(cancelEditBtn) cancelEditBtn.style.display = 'none';
        modoEdicion = false;
        if(descripcionInput) descripcionInput.focus();
    }

    if(cancelEditBtn) cancelEditBtn.addEventListener('click', resetearFormulario);

    function manejarSubmitFormulario(e) {
        e.preventDefault();
        if (!tipoIngresoRadio || !tipoGastoRadio || !fechaInput || !descripcionInput || !montoInput || !categoriaSelect) return;
        const tipoTransaccion = tipoIngresoRadio.checked ? 'ingreso' : 'gasto';
        let montoAbsoluto = parseFloat(montoInput.value);
        const id = transaccionIdInput.value ? parseInt(transaccionIdInput.value) : null;
        if (fechaInput.value === '' || descripcionInput.value.trim() === '' || montoInput.value.trim() === '' || categoriaSelect.value === '') {
            alert('Por favor, completa todos los campos.'); return;
        }
        if (isNaN(montoAbsoluto) || montoAbsoluto <= 0) {
            alert('Por favor, introduce un monto positivo válido.'); return;
        }
        const montoFinal = tipoTransaccion === 'gasto' ? -montoAbsoluto : montoAbsoluto;
        const transaccionData = {
            fecha: fechaInput.value, descripcion: descripcionInput.value.trim(),
            monto: montoFinal, categoria: categoriaSelect.value, tipo: tipoTransaccion
        };
        if (modoEdicion && id) {
            const index = transacciones.findIndex(t => t.id === id);
            if (index > -1) transacciones[index] = { id: id, ...transaccionData };
        } else {
            transaccionData.id = generarID();
            transacciones.push(transaccionData);
        }
        guardarTransaccionesEnLocalStorage();
        resetearFormulario();
        init();
    }

    function cargarTransaccionParaEditar(id) {
        const transaccion = transacciones.find(t => t.id === id);
        if (!transaccion || !formTitleEl || !submitBtn || !cancelEditBtn || !transaccionIdInput || !fechaInput || !descripcionInput || !montoInput || !tipoIngresoRadio || !tipoGastoRadio) return;
        modoEdicion = true;
        formTitleEl.textContent = 'Editar Transacción';
        submitBtn.textContent = 'Guardar Cambios';
        cancelEditBtn.style.display = 'inline-block';
        transaccionIdInput.value = transaccion.id;
        fechaInput.value = transaccion.fecha;
        descripcionInput.value = transaccion.descripcion;
        montoInput.value = Math.abs(transaccion.monto);
        const tipoActual = transaccion.tipo || (transaccion.monto > 0 ? 'ingreso' : 'gasto');
        if (tipoActual === 'ingreso') {
            tipoIngresoRadio.checked = true; popularCategorias('ingreso', transaccion.categoria);
        } else {
            tipoGastoRadio.checked = true; popularCategorias('gasto', transaccion.categoria);
        }
        const seccionFormulario = document.getElementById('nueva-transaccion-section');
        if(seccionFormulario) seccionFormulario.scrollIntoView({ behavior: 'smooth' });
        if(descripcionInput) descripcionInput.focus();
    }

    function añadirTransaccionDOM(transaccion) {
        const item = document.createElement('li');
        item.classList.add(transaccion.monto < 0 ? 'gasto' : 'ingreso');
        item.setAttribute('data-id', transaccion.id);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'transaccion-checkbox';
        checkbox.value = transaccion.id;

        const fechaSpan = document.createElement('span');
        fechaSpan.className = 'fecha-transaccion';
        fechaSpan.textContent = formatearFechaParaDisplay(transaccion.fecha);

        const descContainer = document.createElement('div');
        descContainer.className = 'descripcion-container';
        const categoriaTag = document.createElement('span');
        categoriaTag.className = 'categoria-tag';
        categoriaTag.textContent = transaccion.categoria;
        const descripcionSpan = document.createElement('span');
        descripcionSpan.className = 'descripcion-transaccion';
        descripcionSpan.textContent = transaccion.descripcion;
        descContainer.appendChild(categoriaTag);
        descContainer.appendChild(descripcionSpan);

        const montoSpan = document.createElement('span');
        montoSpan.className = `monto-transaccion ${transaccion.monto < 0 ? 'gasto-color' : 'ingreso-color'}`;
        montoSpan.textContent = formatearMoneda(transaccion.monto);

        const actionButtonsContainer = document.createElement('div');
        actionButtonsContainer.className = 'action-buttons-container';
        
        const editButton = document.createElement('button');
        editButton.className = 'edit-btn';
        editButton.innerHTML = '&#9998;';
        editButton.title = 'Editar';
        editButton.onclick = () => gestorFinanciero.editarTransaccion(transaccion.id);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = 'Eliminar';
        deleteButton.onclick = () => gestorFinanciero.eliminarTransaccion(transaccion.id);
        
        actionButtonsContainer.appendChild(editButton);
        actionButtonsContainer.appendChild(deleteButton);

        if (transaccion.monto > 0) { // O transaccion.tipo === 'ingreso'
            const invoiceButton = document.createElement('button');
            invoiceButton.className = 'invoice-btn';
            invoiceButton.innerHTML = '&#128179;';
            invoiceButton.title = 'Generar Factura Simplificada';
            invoiceButton.onclick = () => generarFacturaPDFConPromptCliente(transaccion);
            actionButtonsContainer.appendChild(invoiceButton);
        }

        item.appendChild(checkbox);
        item.appendChild(fechaSpan);
        item.appendChild(descContainer);
        item.appendChild(montoSpan);
        item.appendChild(actionButtonsContainer);
        
        if(listaTransaccionesEl) listaTransaccionesEl.appendChild(item);
    }

    function guardarTransaccionesEnLocalStorage() {
        localStorage.setItem('transaccionesPRO_PWA_v1', JSON.stringify(transacciones));
    }

    window.gestorFinanciero = {
        eliminarTransaccion: function(id) {
            if (confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
                transacciones = transacciones.filter(transaccion => transaccion.id !== id);
                guardarTransaccionesEnLocalStorage();
                if (modoEdicion && transaccionIdInput && parseInt(transaccionIdInput.value) === id) {
                    resetearFormulario();
                }
                init();
            }
        },
        editarTransaccion: function(id) {
            cargarTransaccionParaEditar(id);
        }
    };

    // --- LÓGICA DE GRÁFICOS ---
     function crearOActualizarGrafico(ctx, instanciaGraficoExistente, labels, dataIngresos, dataGastos, titulo) {
        if (!ctx) return null;
        const datasets = [];
        function generarVariaciones(baseColorRGB, count) {
            const colores = [];
            const [r, g, b] = baseColorRGB;
            for (let i = 0; i < count; i++) {
                const factor = 1 - (i * 0.10);
                let R = Math.floor(r * factor);
                let G = Math.floor(g * factor);
                let B = Math.floor(b * factor);
                R = Math.min(255, Math.max(30, R)); 
                G = Math.min(255, Math.max(30, G));
                B = Math.min(255, Math.max(30, B));
                colores.push(`rgba(${R}, ${G}, ${B}, 0.8)`);
            }
            return colores.length > 0 ? colores : [`rgba(${r},${g},${b},0.8)`];
        }

        if (dataIngresos.some(d => d > 0)) {
            datasets.push({
                label: 'Ingresos', data: dataIngresos,
                backgroundColor: generarVariaciones([46, 204, 113], dataIngresos.filter(d=>d>0).length),
                borderColor: '#2c2c2c', borderWidth: 1
            });
        }
        if (dataGastos.some(d => d > 0)) {
            datasets.push({
                label: 'Gastos', data: dataGastos,
                backgroundColor: generarVariaciones([192, 57, 43], dataGastos.filter(d=>d>0).length),
                borderColor: '#2c2c2c', borderWidth: 1
            });
        }
        if (datasets.length === 0) {
             if (instanciaGraficoExistente) { instanciaGraficoExistente.destroy(); instanciaGraficoExistente = null; }
             return null;
        }
        if (instanciaGraficoExistente) {
            instanciaGraficoExistente.data.labels = labels;
            instanciaGraficoExistente.data.datasets = datasets;
            instanciaGraficoExistente.options.plugins.title.text = titulo;
            instanciaGraficoExistente.update();
            return instanciaGraficoExistente;
        } else {
            return new Chart(ctx, {
                type: 'doughnut', data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true, maintainAspectRatio: true, cutout: '60%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#f0f0f0', boxWidth: 12, padding: 10, font: {size: 10} } },
                        title: { display: true, text: titulo, color: '#DAA520', font: { size: 14, family: "'Orbitron', sans-serif" }, padding: { top: 10, bottom: 15 } },
                        tooltip: { callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || ''; let categoria = context.label || '';
                                    if (label) label += ` (${categoria})`; else label = categoria;
                                    if (context.parsed !== null) label += ': ' + formatearMoneda(context.parsed);
                                    return label;
                                }
                        }}
                    }
                }
            });
        }
    }
    function mostrarDesgloseCategorias(elementoDOMLista, transaccionesFiltradas, ctxGrafico, instanciaGrafico, periodoTitulo) {
        if(elementoDOMLista) elementoDOMLista.innerHTML = ''; else return null;
        const resumenCategorias = {};
        transaccionesFiltradas.forEach(t => {
            if (!resumenCategorias[t.categoria]) resumenCategorias[t.categoria] = {ingreso: 0, gasto: 0};
            if (t.monto > 0) resumenCategorias[t.categoria].ingreso += t.monto;
            else resumenCategorias[t.categoria].gasto += Math.abs(t.monto);
        });
        const todasLasCategoriasUnicas = [...new Set(transaccionesFiltradas.map(t => t.categoria))].sort();
        if (todasLasCategoriasUnicas.length === 0) {
            elementoDOMLista.innerHTML = '<li>No hay datos para este periodo.</li>';
            if (instanciaGrafico) { instanciaGrafico.destroy(); instanciaGrafico = null; }
            return null;
        }
        const listaDetallada = todasLasCategoriasUnicas.map(catNombre => {
            const datosCat = resumenCategorias[catNombre] || {ingreso: 0, gasto: 0};
            return { nombre: catNombre, neto: datosCat.ingreso - datosCat.gasto };
        }).sort((a,b) => Math.abs(b.neto) - Math.abs(a.neto));
        listaDetallada.forEach(cat => {
            if (cat.neto === 0 && !(resumenCategorias[cat.nombre]?.ingreso > 0 || resumenCategorias[cat.nombre]?.gasto > 0) ) return;
            const li = document.createElement('li');
            li.innerHTML = `<span class="cat-nombre">${cat.nombre}</span>
                            <span class="cat-monto ${cat.neto < 0 ? 'gasto-color' : (cat.neto > 0 ? 'ingreso-color' : '')}">${formatearMoneda(cat.neto)}</span>`;
            elementoDOMLista.appendChild(li);
        });
        
        const labelsParaGrafico = [];
        const ingresosFiltradosParaGrafico = [];
        const gastosFiltradosParaGrafico = [];

        todasLasCategoriasUnicas.forEach(cat => {
            const ingresoCat = resumenCategorias[cat]?.ingreso || 0;
            const gastoCat = resumenCategorias[cat]?.gasto || 0;
            if (ingresoCat > 0 || gastoCat > 0) {
                labelsParaGrafico.push(cat);
                ingresosFiltradosParaGrafico.push(ingresoCat);
                gastosFiltradosParaGrafico.push(gastoCat);
            }
        });

        if (labelsParaGrafico.length === 0) {
            if (instanciaGrafico) { instanciaGrafico.destroy(); instanciaGrafico = null; }
            return null;
        }
        return crearOActualizarGrafico(ctxGrafico, instanciaGrafico, labelsParaGrafico, ingresosFiltradosParaGrafico, gastosFiltradosParaGrafico, `Categorías ${periodoTitulo}`);
    }
    function actualizarBalancesYResumenes() {
        const montos = transacciones.map(t => t.monto);
        const totalGeneral = montos.reduce((acc, item) => (acc += item), 0);
        const ingresosGenerales = montos.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
        const gastosGenerales = montos.filter(item => item < 0).reduce((acc, item) => (acc += item), 0);
        if(balanceActualEl) balanceActualEl.textContent = formatearMoneda(totalGeneral);
        if(totalIngresosEl) totalIngresosEl.textContent = formatearMoneda(ingresosGenerales);
        if(totalGastosEl) totalGastosEl.textContent = formatearMoneda(gastosGenerales * -1);
        if(balanceActualEl) balanceActualEl.className = totalGeneral < 0 ? 'gasto-color' : (totalGeneral > 0 ? 'ingreso-color' : 'dorado-color');
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const anoActual = hoy.getFullYear();
        const transaccionesMes = transacciones.filter(t => {
            const fechaT = new Date(t.fecha);
            const offset = fechaT.getTimezoneOffset();
            const fechaCorregidaComparar = new Date(fechaT.valueOf() + offset * 60 * 1000);
            return fechaCorregidaComparar.getMonth() === mesActual && fechaCorregidaComparar.getFullYear() === anoActual;
        });
        const ingresosMes = transaccionesMes.filter(t => t.monto > 0).reduce((acc, t) => acc + t.monto, 0);
        const gastosMes = transaccionesMes.filter(t => t.monto < 0).reduce((acc, t) => acc + t.monto, 0);
        const balanceMesNeto = ingresosMes + gastosMes;
        if(ingresosMesEl) ingresosMesEl.textContent = formatearMoneda(ingresosMes);
        if(gastosMesEl) gastosMesEl.textContent = formatearMoneda(gastosMes * -1);
        if(balanceMesEl) balanceMesEl.textContent = formatearMoneda(balanceMesNeto);
        if(balanceMesEl) balanceMesEl.className = balanceMesNeto < 0 ? 'gasto-color' : (balanceMesNeto > 0 ? 'ingreso-color' : 'dorado-color');
        graficoMes = mostrarDesgloseCategorias(categoriasResumenMesEl, transaccionesMes, graficoCategoriasMesCtx, graficoMes, "del Mes");
        const transaccionesAno = transacciones.filter(t => {
            const fechaT = new Date(t.fecha);
            const offset = fechaT.getTimezoneOffset();
            const fechaCorregidaComparar = new Date(fechaT.valueOf() + offset * 60 * 1000);
            return fechaCorregidaComparar.getFullYear() === anoActual;
        });
        const ingresosAno = transaccionesAno.filter(t => t.monto > 0).reduce((acc, t) => acc + t.monto, 0);
        const gastosAno = transaccionesAno.filter(t => t.monto < 0).reduce((acc, t) => acc + t.monto, 0);
        const balanceAnoNeto = ingresosAno + gastosAno;
        if(ingresosAnoEl) ingresosAnoEl.textContent = formatearMoneda(ingresosAno);
        if(gastosAnoEl) gastosAnoEl.textContent = formatearMoneda(gastosAno * -1);
        if(balanceAnoEl) balanceAnoEl.textContent = formatearMoneda(balanceAnoNeto);
        if(balanceAnoEl) balanceAnoEl.className = balanceAnoNeto < 0 ? 'gasto-color' : (balanceAnoNeto > 0 ? 'ingreso-color' : 'dorado-color');
        graficoAno = mostrarDesgloseCategorias(categoriasResumenAnoEl, transaccionesAno, graficoCategoriasAnoCtx, graficoAno, "del Año");
    }

    // --- FUNCIONES PDF ---
    function generarEncabezadoPDF(doc, tituloDoc) {
        const pageWidth = doc.internal.pageSize.width;
        let yPosition = 15;
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text(misDatosEmpresa.nombre, pageWidth - 15, yPosition, { align: 'right' });
        yPosition += 5; doc.text(misDatosEmpresa.direccion, pageWidth - 15, yPosition, { align: 'right' });
        yPosition += 5; doc.text(`NIF: ${misDatosEmpresa.nif}`, pageWidth - 15, yPosition, { align: 'right' });
        yPosition += 5; doc.text(misDatosEmpresa.email, pageWidth - 15, yPosition, { align: 'right' });
        yPosition = 30;
        doc.setFontSize(22); doc.setTextColor(40); doc.setFont(undefined, 'bold');
        doc.text(tituloDoc, 15, yPosition);
        doc.setFont(undefined, 'normal');
        return yPosition + 15;
    }
    function generarPieDePaginaPDF(doc, numeroPagina) {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Página ${numeroPagina}`, doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
        if(misDatosEmpresa.web) doc.text(misDatosEmpresa.web, 15, pageHeight - 10);
    }
    function generarFacturaPDFConPromptCliente(transaccion) {
        const nombreCliente = prompt("Nombre del Cliente:", "Cliente Contado");
        if (nombreCliente === null) return;
        const direccionCliente = prompt("Dirección del Cliente (opcional):", "");
        const nifCliente = prompt("NIF/CIF del Cliente (opcional):", "");
        const datosClienteActual = {
            nombre: nombreCliente || "Cliente Contado",
            direccion: direccionCliente || "",
            nif: nifCliente || ""
        };
        generarFacturaPDF(transaccion, datosClienteActual);
    }
    function generarFacturaPDF(transaccion, datosCliente) {
        if (transaccion.monto <= 0) { alert("Solo se pueden generar facturas para ingresos."); return; }
        const doc = new jsPDF();
        let yPosition = generarEncabezadoPDF(doc, "FACTURA SIMPLIFICADA");
        const margin = 15; const pageWidth = doc.internal.pageSize.width;
        doc.setFontSize(10); doc.setTextColor(40);
        const numFactura = `F-${new Date(transaccion.fecha).getFullYear()}-${String(transaccion.id).padStart(4, '0')}`;
        doc.text(`Factura Nº: ${numFactura}`, margin, yPosition);
        doc.text(`Fecha: ${formatearFechaParaDisplay(transaccion.fecha)}`, pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 7;
        const fechaVenc = new Date(transaccion.fecha); fechaVenc.setDate(new Date(transaccion.fecha).getDate() + 7);
        doc.text(`Vencimiento: ${formatearFechaParaDisplay(fechaVenc.toISOString().split('T')[0])}`, pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 10;
        doc.setFont(undefined, 'bold'); doc.text("Cliente:", margin, yPosition);
        doc.setFont(undefined, 'normal'); yPosition += 5;
        doc.text(datosCliente.nombre, margin, yPosition); yPosition += 5;
        if(datosCliente.direccion) { doc.text(datosCliente.direccion, margin, yPosition); yPosition += 5;}
        if(datosCliente.nif) { doc.text(`NIF: ${datosCliente.nif}`, margin, yPosition); yPosition += 5;}
        yPosition += 10;
        const tableHeader = [['Descripción', 'Cant.', 'P.Unit (€)', 'Importe (€)']];
        const tableBody = [[
            `${transaccion.descripcion} (Cat: ${transaccion.categoria})`, 1,
            formatearMoneda(transaccion.monto).replace('€','').trim(),
            formatearMoneda(transaccion.monto).replace('€','').trim()
        ]];
        if (doc.autoTable) {
            doc.autoTable({
                head: tableHeader, body: tableBody, startY: yPosition, theme: 'striped',
                headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
                didDrawPage: (data) => generarPieDePaginaPDF(doc, data.pageNumber)
            });
            yPosition = doc.lastAutoTable.finalY + 10;
        } else { yPosition += 20; }
        doc.setFontSize(10); const totalXPosition = pageWidth - margin - 60;
        yPosition += 5; doc.setFont(undefined, 'bold');
        doc.text("Subtotal:", totalXPosition, yPosition, { align: 'left' });
        doc.setFont(undefined, 'normal');
        doc.text(formatearMoneda(transaccion.monto), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 7;
        doc.setLineWidth(0.3); doc.line(totalXPosition - 5, yPosition, pageWidth - margin, yPosition);
        yPosition += 7;
        doc.setFontSize(12); doc.setFont(undefined, 'bold');
        doc.text("TOTAL:", totalXPosition, yPosition, { align: 'left' });
        doc.setTextColor(46, 204, 113);
        doc.text(formatearMoneda(transaccion.monto), pageWidth - margin, yPosition, { align: 'right' });
        doc.setTextColor(40);
        yPosition += 20; doc.setFontSize(8); doc.setTextColor(100);
        /*doc.text("Condiciones de pago: A 30 días fecha factura.", margin, yPosition); yPosition += 5;
        doc.text("Por favor, incluya el número de factura en la referencia del pago.", margin, yPosition);*/
        if (!doc.autoTable) generarPieDePaginaPDF(doc, 1);
        doc.save(`Factura-${numFactura}.pdf`);
    }
    function descargarReportePDF(transaccionesParaDescargar) {
        if (!transaccionesParaDescargar || transaccionesParaDescargar.length === 0) {
            alert('Por favor, selecciona al menos una transacción para descargar el reporte.'); return;
        }
        const doc = new jsPDF();
        let yPosition = generarEncabezadoPDF(doc, "REPORTE DE TRANSACCIONES");
        const margin = 15;
        if (doc.autoTable) {
            const head = [["Fecha", "Descripción", "Categoría", "Monto (€)"]];
            const body = transaccionesParaDescargar.map(t => [
                formatearFechaParaDisplay(t.fecha), t.descripcion, t.categoria,
                { content: formatearMoneda(t.monto), styles: { halign: 'right', textColor: t.monto >= 0 ? [46, 204, 113] : [192, 57, 43] } }
            ]);
            doc.autoTable({
                head: head, body: body, startY: yPosition, theme: 'striped',
                headStyles: { fillColor: [52, 73, 94], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 3: { halign: 'right' } },
                didDrawPage: (data) => generarPieDePaginaPDF(doc, data.pageNumber)
            });
            yPosition = doc.lastAutoTable.finalY + 10;
        } else { yPosition += 20; }
        const totalIngresosPDF = transaccionesParaDescargar.filter(t => t.monto > 0).reduce((sum, t) => sum + t.monto, 0);
        const totalGastosPDF = transaccionesParaDescargar.filter(t => t.monto < 0).reduce((sum, t) => sum + t.monto, 0);
        yPosition = Math.max(yPosition, doc.internal.pageSize.height - 50);
        if (yPosition > doc.internal.pageSize.height - 35) { doc.addPage(); yPosition = margin; }
        doc.setFontSize(10); doc.setFont(undefined, 'bold');
        doc.setTextColor(46, 204, 113);
        doc.text('Total Ingresos Seleccionados:', margin, yPosition);
        doc.text(formatearMoneda(totalIngresosPDF), doc.internal.pageSize.width - margin, yPosition, {align: 'right'});
        yPosition += 7; doc.setTextColor(192, 57, 43);
        doc.text('Total Gastos Seleccionados:', margin, yPosition);
        doc.text(formatearMoneda(totalGastosPDF * -1), doc.internal.pageSize.width - margin, yPosition, {align: 'right'});
        yPosition += 7; doc.setTextColor(40);
        doc.text('Balance Neto Seleccionado:', margin, yPosition);
        doc.text(formatearMoneda(totalIngresosPDF + totalGastosPDF), doc.internal.pageSize.width - margin, yPosition, {align: 'right'});
        if (!doc.autoTable) generarPieDePaginaPDF(doc, doc.internal.getNumberOfPages());
        doc.save('reporte-transacciones.pdf');
    }

    // Event Listeners
    if (seleccionarTodasBtn) seleccionarTodasBtn.addEventListener('click', () => document.querySelectorAll('.transaccion-checkbox').forEach(cb => cb.checked = true));
    if (deseleccionarTodasBtn) deseleccionarTodasBtn.addEventListener('click', () => document.querySelectorAll('.transaccion-checkbox').forEach(cb => cb.checked = false));
    if (descargarPdfBtn) descargarPdfBtn.addEventListener('click', () => {
        const idsSeleccionados = Array.from(document.querySelectorAll('.transaccion-checkbox:checked')).map(cb => parseInt(cb.value));
        const transaccionesSeleccionadas = transacciones.filter(t => idsSeleccionados.includes(t.id));
        descargarReportePDF(transaccionesSeleccionadas);
    });
    
    function init() {
        if(listaTransaccionesEl) listaTransaccionesEl.innerHTML = '';
        transacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id);
        transacciones.forEach(añadirTransaccionDOM);
        actualizarBalancesYResumenes();
        if (!modoEdicion) {
            popularCategorias(tipoIngresoRadio && tipoIngresoRadio.checked ? 'ingreso' : 'gasto');
        }
    }
    if (formTransaccion) formTransaccion.addEventListener('submit', manejarSubmitFormulario);
    
    // Inicialización
    resetearFormulario(); // Llamar primero para configurar el estado inicial del formulario
    init(); // Luego cargar datos y actualizar UI

    // --- REGISTRO DEL SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js') // Asegúrate que sw.js esté en la raíz
                .then(registration => {
                    console.log('ServiceWorker: Registrado correctamente, scope:', registration.scope);
                })
                .catch(error => {
                    console.error('ServiceWorker: Fallo en el registro:', error);
                });
        });
    }

}); // Fin DOMContentLoaded