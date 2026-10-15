import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [data, setData] = useState({
    mesesHistorial: {},
    gastosCatriel: [],
    gastosLisandro: [],
    prestamosCatriel: [],
    prestamosLisandro: [],
    tarjetasCatriel: [],
    tarjetasLisandro: []
  });
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('Cargando...');

  // Form de gastos
  const [personaGasto, setPersonaGasto] = useState('Catriel');
  const [descGasto, setDescGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [esCompartido, setEsCompartido] = useState(false);

  // Cargar datos de Supabase
  useEffect(() => {
    cargarDatos();
    
    // Suscripción en tiempo real
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finanzas' },
        (payload) => {
          if (payload.new && payload.new.content) {
            setData(payload.new.content);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const { data: result, error } = await supabase
        .from('finanzas')
        .select('content')
        .eq('key', 'datos_hogar')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(error);
        setStatusMsg('Error al conectar con la base de datos.');
      } else if (result && result.content && Object.keys(result.content).length > 0) {
        setData(result.content);
        setStatusMsg('Conectado en vivo');
      } else {
        setStatusMsg('Base de datos inicializada');
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const guardarEnSupabase = async (nuevosDatos) => {
    setData(nuevosDatos);
    try {
      const { error } = await supabase
        .from('finanzas')
        .upsert({ key: 'datos_hogar', content: nuevosDatos }, { onConflict: 'key' });
      
      if (error) {
        console.error('Error al guardar:', error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const agregarGasto = (e) => {
    e.preventDefault();
    if (!descGasto || !montoGasto) return;

    const nuevo = {
      id: Date.now(),
      descripcion: descGasto,
      monto: parseFloat(montoGasto),
      esCompartido,
      fecha: new Date().toISOString()
    };

    const key = personaGasto === 'Catriel' ? 'gastosCatriel' : 'gastosLisandro';
    const nuevosDatos = {
      ...data,
      [key]: [...(data[key] || []), nuevo]
    };

    guardarEnSupabase(nuevosDatos);
    setDescGasto('');
    setMontoGasto('');
  };

  const eliminarGasto = (persona, id) => {
    const key = persona === 'Catriel' ? 'gastosCatriel' : 'gastosLisandro';
    const nuevosDatos = {
      ...data,
      [key]: (data[key] || []).filter(g => g.id !== id)
    };
    guardarEnSupabase(nuevosDatos);
  };

  // Cálculos de totales
  const totalCatrielPropios = (data.gastosCatriel || [])
    .filter(g => !g.esCompartido)
    .reduce((acc, g) => acc + g.monto, 0);

  const totalCatrielCompartidos = (data.gastosCatriel || [])
    .filter(g => g.esCompartido)
    .reduce((acc, g) => acc + g.monto, 0);

  const totalLisandroPropios = (data.gastosLisandro || [])
    .filter(g => !g.esCompartido)
    .reduce((acc, g) => acc + g.monto, 0);

  const totalLisandroCompartidos = (data.gastosLisandro || [])
    .filter(g => g.esCompartido)
    .reduce((acc, g) => acc + g.monto, 0);

  // Balance 50/50 de gastos compartidos
  const diferenciaCompartida = totalCatrielCompartidos - totalLisandroCompartidos;
  let saldoCompartidoTexto = 'Están a mano en gastos compartidos';
  if (diferenciaCompartida > 0) {
    saldoCompartidoTexto = `Lisandro debe pagarle $${(diferenciaCompartida / 2).toLocaleString()} a Catriel`;
  } else if (diferenciaCompartida < 0) {
    saldoCompartidoTexto = `Catriel debe pagarle $${(Math.abs(diferenciaCompartida) / 2).toLocaleString()} a Lisandro`;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h2>🔄 Cargando Finanzas del Hogar...</h2>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '20px' }}>
      <header style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, color: '#1f2937' }}>🏡 Finanzas del Hogar</h1>
          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
            🟢 {statusMsg}
          </span>
        </div>
      </header>

      {/* Resumen del Balance */}
      <div style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', opacity: 0.9 }}>Balance Gastos Compartidos (50 / 50)</h2>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{saldoCompartidoTexto}</p>
      </div>

      {/* Formulario de Registro */}
      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, color: '#374151' }}>➕ Registrar Nuevo Gasto</h3>
        <form onSubmit={agregarGasto} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            value={personaGasto} 
            onChange={(e) => setPersonaGasto(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
          >
            <option value="Catriel">Catriel</option>
            <option value="Lisandro">Lisandro</option>
          </select>

          <input 
            type="text" 
            placeholder="Descripción (ej. Alquiler, Supermercado)" 
            value={descGasto} 
            onChange={(e) => setDescGasto(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', flex: '1', minWidth: '200px', fontSize: '14px' }}
          />

          <input 
            type="number" 
            placeholder="Monto ($)" 
            value={montoGasto} 
            onChange={(e) => setMontoGasto(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', width: '120px', fontSize: '14px' }}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
            <input 
              type="checkbox" 
              checked={esCompartido} 
              onChange={(e) => setEsCompartido(e.target.checked)} 
            />
            ¿Es compartido? (50/50)
          </label>

          <button 
            type="submit" 
            style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '10px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
          >
            Guardar Gasto
          </button>
        </form>
      </div>

      {/* Tablas de Gastos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Columna Catriel */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2563eb', borderBottom: '2px solid #2563eb', paddingBottom: '8px', marginTop: 0 }}>
            Gastos de Catriel
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Propios: <strong>${totalCatrielPropios.toLocaleString()}</strong> \vert{} Compartidos: <strong>${totalCatrielCompartidos.toLocaleString()}</strong>
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {(data.gastosCatriel || []).length === 0 && <li style={{ color: '#9ca3af', fontSize: '14px' }}>No hay gastos registrados.</li>}
            {(data.gastosCatriel || []).map(g => (
              <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                <div>
                  <strong>{g.descripcion}</strong>
                  {g.esCompartido && <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px' }}>Compartido</span>}
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '10px' }}>${g.monto.toLocaleString()}</span>
                  <button onClick={() => eliminarGasto('Catriel', g.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Columna Lisandro */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#059669', borderBottom: '2px solid #059669', paddingBottom: '8px', marginTop: 0 }}>
            Gastos de Lisandro
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Propios: <strong>${totalLisandroPropios.toLocaleString()}</strong> \vert{} Compartidos: <strong>${totalLisandroCompartidos.toLocaleString()}</strong>
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {(data.gastosLisandro || []).length === 0 && <li style={{ color: '#9ca3af', fontSize: '14px' }}>No hay gastos registrados.</li>}
            {(data.gastosLisandro || []).map(g => (
              <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                <div>
                  <strong>{g.descripcion}</strong>
                  {g.esCompartido && <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: '4px' }}>Compartido</span>}
                </div>
                <div>
