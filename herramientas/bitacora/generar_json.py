"""Convierte los registros de octubre 2026 de la bitácora en JSON normalizado para la carga."""
import json, sys, datetime, collections
import openpyxl

SRC = sys.argv[1]; OUT = sys.argv[2]
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['Registro Autos Legaria 2025']
rows = [r for r in ws.iter_rows(min_row=14, values_only=True) if r[1] or r[9]]

def oct26(v): return isinstance(v, datetime.datetime) and v.year == 2026 and v.month == 10
sel = [r for r in rows if oct26(r[3]) or oct26(r[18]) or oct26(r[32])]

COLORES = {'BLANCO', 'GRIS', 'NEGRO', 'ROJO', 'AZUL', 'PLATA', 'ARENA', 'CAFÉ', 'AMARILLO', 'VERDE', 'VINO'}
MODELOS = {  # texto de la bitácora -> (marca, modelo)
 'ACADIA': ('GMC', 'ACADIA'), 'ACCENT': ('HYUNDAI', 'ACCENT'), 'ACCORD': ('HONDA', 'ACCORD'), 'ATTITUD': ('DODGE', 'ATTITUDE'),
 'AUDI A6': ('AUDI', 'A6'), 'AVANZA': ('TOYOTA', 'AVANZA'), 'AVEO': ('CHEVROLET', 'AVEO'), 'BEAT': ('CHEVROLET', 'BEAT'),
 'BMW 220i': ('BMW', '220i'), 'BMW 3': ('BMW', 'SERIE 3'), 'BRV': ('HONDA', 'BR-V'), 'CAVALIER': ('CHEVROLET', 'CAVALIER'),
 'CHEVY': ('CHEVROLET', 'CHEVY'), 'CHEYENNE': ('CHEVROLET', 'CHEYENNE'), 'CITY': ('HONDA', 'CITY'), 'CIVIC': ('HONDA', 'CIVIC'),
 'COROLLA CROSS': ('TOYOTA', 'COROLLA CROSS'), 'COROLLA': ('TOYOTA', 'COROLLA'), 'CORSA': ('CHEVROLET', 'CORSA'),
 'CRV': ('HONDA', 'CR-V'), 'CUPRA': ('CUPRA', 'CUPRA'), 'CX5': ('MAZDA', 'CX-5'), 'DUSTER': ('RENAULT', 'DUSTER'),
 'ESCAPE': ('FORD', 'ESCAPE'), 'FIAT 500': ('FIAT', '500'), 'FORTE': ('KIA', 'FORTE'), 'GOL': ('VOLKSWAGEN', 'GOL'),
 'GOLF': ('VOLKSWAGEN', 'GOLF'), 'HRV': ('HONDA', 'HR-V'), 'IBIZA': ('SEAT', 'IBIZA'), 'IGNIS': ('SUZUKI', 'IGNIS'),
 'IKON': ('FORD', 'IKON'), 'JACK SEI3': ('JAC', 'SEI3'), 'JETTA': ('VOLKSWAGEN', 'JETTA'), 'JOURNEY': ('DODGE', 'JOURNEY'),
 'K3': ('KIA', 'K3'), 'KA4': ('FORD', 'KA'), 'KOLEOS': ('RENAULT', 'KOLEOS'), 'KWID': ('RENAULT', 'KWID'),
 'LANCER': ('MITSUBISHI', 'LANCER'), 'LINCOLN': ('LINCOLN', 'LINCOLN'), 'MAZDA 2': ('MAZDA', 'MAZDA 2'), 'MAZDA 3': ('MAZDA', 'MAZDA 3'),
 'MAZDA 6': ('MAZDA', 'MAZDA 6'), 'MAZDA CX5': ('MAZDA', 'CX-5'), 'MAZDA CX7': ('MAZDA', 'CX-7'), 'MAZDA CX9': ('MAZDA', 'CX-9'),
 'MERCEDES C200': ('MERCEDES-BENZ', 'C200'), 'MERCEDES': ('MERCEDES-BENZ', 'MERCEDES'), 'MG 5': ('MG', 'MG5'), 'MG5': ('MG', 'MG5'),
 'MG RX5': ('MG', 'RX5'), 'MINICOOOPER': ('MINI', 'COOPER'), 'MINICOOPER': ('MINI', 'COOPER'), 'OMODA 5': ('OMODA', 'OMODA 5'),
 'ONIX': ('CHEVROLET', 'ONIX'), 'PARTNER': ('PEUGEOT', 'PARTNER'), 'PATRIOT': ('JEEP', 'PATRIOT'), 'POLO': ('VOLKSWAGEN', 'POLO'),
 'RIO': ('KIA', 'RIO'), 'ROUG': ('NISSAN', 'ROGUE'), 'SAVEIRO': ('VOLKSWAGEN', 'SAVEIRO'), 'SCENIC': ('RENAULT', 'SCENIC'),
 'SEQUOIA': ('TOYOTA', 'SEQUOIA'), 'SILVERADO': ('CHEVROLET', 'SILVERADO'), 'SMART': ('SMART', 'FORTWO'), 'SONIC': ('CHEVROLET', 'SONIC'),
 'SOUL': ('KIA', 'SOUL'), 'SPARK': ('CHEVROLET', 'SPARK'), 'STEPWEY': ('RENAULT', 'STEPWAY'), 'SUBURBAN': ('CHEVROLET', 'SUBURBAN'),
 'SWIFT': ('SUZUKI', 'SWIFT'), 'TIIDA': ('NISSAN', 'TIIDA'), 'TRAX': ('CHEVROLET', 'TRAX'), 'TUCSON': ('HYUNDAI', 'TUCSON'),
 'VENTO': ('VOLKSWAGEN', 'VENTO'), 'VERSA': ('NISSAN', 'VERSA'), 'VITARA': ('SUZUKI', 'VITARA'), 'VOLVO XC40': ('VOLVO', 'XC40'),
 'VOYAGER': ('CHRYSLER', 'VOYAGER'), 'XTRAIL': ('NISSAN', 'X-TRAIL'), 'YARIS': ('TOYOTA', 'YARIS'),
}
TEC = {'EDGAR VILLALBA GARCIA': 1, 'RODRIGO MEDINA VENTURA': 2, 'MIGUEL ANGEL GARCIA SANTIAGO': 4, 'NACHO': 8,
       'URIEL MEDINA MORALES': 9, 'VICTOR ALFONSO LOPEZ GARCIA': 10}

def txt(v):
    if v is None: return None
    if isinstance(v, float) and v.is_integer(): v = int(v)
    s = str(v).strip()
    return None if s in ('', 'N/A', 'None', 'CANCELADO') else s
def num(v): return round(float(v), 2) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0
def fecha(v): return v.strftime('%Y-%m-%d') if isinstance(v, datetime.datetime) else None
def tec(v): return TEC.get(str(v).strip().upper()) if isinstance(v, str) else None

avisos = collections.Counter()
regs = []
for r in sel:
    auto = txt(r[7]) or ''
    partes = auto.split()
    color = partes[-1] if partes and partes[-1] in COLORES else None
    base = ' '.join(partes[:-1] if color else partes)
    marca, modelo = MODELOS.get(base, (None, None))
    if not marca:
        avisos['vehiculo sin marca/modelo: ' + (auto or '(vacío)')] += 1
        marca, modelo = 'SIN DATO', base or 'SIN DATO'
    anio = r[8] if isinstance(r[8], int) and 1950 <= r[8] <= 2100 else None
    status = txt(r[21])
    tiene_orden = isinstance(r[18], datetime.datetime)
    comp = txt(r[2])
    d = {
        'os': txt(r[1]), 'compania': comp, 'fecha_asignacion': fecha(r[3]),
        'siniestro_mapfre': txt(r[6]), 'siniestro_legaria': txt(r[17]),
        'marca': marca, 'modelo': modelo, 'color': color, 'anio': anio, 'placas': (txt(r[9]) or '').upper() or None,
        'contacto': txt(r[10]), 'telefono': txt(r[11]), 'fecha_cita': fecha(r[12]), 'observaciones': txt(r[15]),
        'status': status, 'orden': tiene_orden,
        'fecha_ingreso': fecha(r[18]), 'fecha_autorizacion': fecha(r[27]), 'promesa': fecha(r[28]) or fecha(r[29]),
        'fecha_entrega': fecha(r[32]), 'inicio': fecha(r[49]), 'termino': fecha(r[50]),
        'avance': [bool(x) for x in r[38:45]], 'comentarios': txt(r[46]),
        # ingresos autorizados
        'mo_carroceria': num(r[69]), 'mo_mecanica': num(r[70]), 'mo_pintura': num(r[72]), 'materiales_aut': num(r[73]),
        'pago_refacciones': num(r[64]), 'monto_autorizado': num(r[75]), 'particular_adicional': num(r[76]),
        # gasto parte aseguradora
        'hojalatero': tec(r[78]), 'pintor': tec(r[79]),
        'pago_hojalatero': num(r[85]), 'pago_pintor': num(r[87]), 'pulido': num(r[89]), 'materiales': num(r[90]), 'refacciones': num(r[91]),
        # gasto parte particular
        'p_pago': num(r[95]), 'p_hojalatero': num(r[96]), 'p_pintor': num(r[97]), 'p_pulido': num(r[98]), 'p_materiales': num(r[99]), 'p_refacciones': num(r[100]),
        'factura_folio': txt(r[55]), 'factura_fecha': fecha(r[56]), 'factura_importe': num(r[59]),
    }
    if comp == 'MAPFRE' and not d['siniestro_mapfre']:
        avisos['MAPFRE sin siniestro (se usa el de Legaria u OS)'] += 1
    if d['pago_hojalatero'] + d['p_hojalatero'] > 0 and not d['hojalatero']: avisos['pago hojalatero sin técnico: ' + str(r[78])] += 1
    if d['pago_pintor'] + d['p_pintor'] > 0 and not d['pintor']: avisos['pago pintor sin técnico: ' + str(r[79])] += 1
    if comp == 'MAPFRE' and d['monto_autorizado'] and abs(d['mo_carroceria'] + d['mo_mecanica'] + d['mo_pintura'] + d['materiales_aut'] + d['pago_refacciones'] - d['monto_autorizado']) > 0.05:
        avisos['monto autorizado no cuadra con desglose: OS ' + str(d['os'])] += 1
    regs.append(d)

json.dump(regs, open(OUT, 'w'), ensure_ascii=False)
print('registros', len(regs), 'con orden', sum(r['orden'] for r in regs))
print('facturas en registros', sum(1 for r in regs if r['factura_folio']))
for k, v in avisos.items(): print('AVISO', v, k)
