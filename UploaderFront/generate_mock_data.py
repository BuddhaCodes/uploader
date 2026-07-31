#!/usr/bin/env python3
"""
Genera un archivo mock .txt con la misma estructura pipe-delimited / quoted
del archivo real, hasta alcanzar un tamaño objetivo en GB.

Uso:
    python generate_mock_data.py --output mock_data.txt --size-gb 11
    python generate_mock_data.py -o mock_data.txt -g 0.5 --seed 42

Pensado para archivos grandes: escribe en streaming por lotes y controla
el tamaño acumulado en bytes ya calculados en memoria (sin llamar a
os.path.getsize en cada fila), así que generar 11GB no es mucho más lento
que generar 100MB.
"""
import argparse
import random
import time
from typing import Optional

HEADER = (
    "ClientID|ProviderCode|BProviderLastName|BProviderFirstName|"
    "BProviderAddress1|BProviderAddress2|BProviderZip|BProviderPhone|"
    "BProviderEntityCode|TaxID|ClientLocalID|BProviderMiddleName|Upin"
)

LAST_NAMES = [
    "MACKMAN", "MORRISON", "ERICKSON", "ALBOUCREK", "DIGIORGIO", "WILLIAMS",
    "GOUGH FIBKINS", "COLE", "FORTGANG", "GUBEN", "SHER", "SPIRA", "BAKER",
    "AUSTER", "RING", "ARFARAS", "MUHLETALER", "BARRETT", "KOSHY", "STALLER",
    "ARCH", "GUILBAUD", "HUGHES", "RABOI", "GORDON", "ABRAMS ROSENBERG",
    "GERONEMUS", "MORGADO LAUREANO", "WALSH", "YOUNG", "LETZEN", "LOMBARDI",
    "PATEL MD", "SURRO MD", "WEISS MD", "RUBIN MD", "COMORA DO",
    "NORTH BROWARD RADIOLOGISTS PA",
]
FIRST_NAMES = [
    "DENNIS", "KENNETH", "JOEL", "MICHAEL", "ERIC", "FREDERICK", "SHAWN",
    "CHARLES", "JON", "HEATHER", "RICHARD", "ROBERT", "BRIAN", "DAVID",
    "NICHOLAS", "CARLOS", "TERRENCE", "GEORGE", "BRETT", "DEBORAH", "LINDA",
    "CARL", "JOHN", "LISA", "ADAM", "ANDRES", "MATTHEW", "BRYCE", "PAMELA",
    "SMEET", "ANDREW", "JARED", "JOSHUA", "BENJAMIN",
]
# Sin inicial en un ~25% de los casos, igual que se ve en el archivo real
MIDDLE_INITIALS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + [""] * 9

# Casi todas las filas del archivo real comparten esta dirección de remito
ADDRESSES = [
    ("PO BOX 223293", "", "152512293", "8662827905"),
    ("PO Box 223293", "", "152512293", "8662827905"),
]

# Filas "especiales" (ajustes, reconciliaciones, providers desconocidos) que
# aparecen mezcladas con las filas normales en el archivo real
SPECIAL_ROWS = [
    ("NBR12", "GERONEMUS", "ADAM", "PO BOX 223293", "", "152512293", "8662827905", "008", "", "I55050"),
    ("NBR33", "UNKNOWN", "DOCTOR", "6501 DEANE HILL DR", "", "37919", "8662827905", "008", "", ""),
    ("NBR999", "DOCTOR999", "UNKNOWN", "", "", "", "", "008", "", ""),
    ("PLAADJ", "Adjustments", "PLA", "", "", "", "", "001", "", ""),
    ("TOS", "Time Of Service", "For Charge", "", "", "", "", "001", "", ""),
    ("UNALC", "PROVIDER", "UNALLOCATED", "", "", "", "", "008", "", ""),
    ("DEPSTRCNCL", "RECONCILIATION", "DEPOSIT", "", "", "", "", "001", "", ""),
]


def q(value: str) -> str:
    """Envuelve un valor entre comillas dobles, escapando comillas internas como ""."""
    return '"' + str(value).replace('"', '""') + '"'


def random_provider_code(rng: random.Random) -> str:
    # La mayoría de ProviderCode en el archivo real son NPIs de 10 dígitos
    return str(rng.randint(1000000000, 1999999999))


def build_row(rng: random.Random, client_local_id: int) -> str:
    # ~2% de filas son "especiales", igual proporción que en el archivo real
    if rng.random() < 0.02:
        code, last, first, addr1, addr2, zip_, phone, entity, taxid, upin = rng.choice(SPECIAL_ROWS)
        fields = ["NBR1", code, last, first, addr1, addr2, zip_, phone, entity, taxid,
                  str(client_local_id), "", upin]
        return "|".join(q(f) for f in fields)

    last = rng.choice(LAST_NAMES)
    is_entity = last in ("NORTH BROWARD RADIOLOGISTS PA",)
    first = "" if is_entity else rng.choice(FIRST_NAMES)
    middle = "" if is_entity else rng.choice(MIDDLE_INITIALS)
    addr1, addr2, zip_, phone = rng.choice(ADDRESSES)

    fields = [
        "NBR1",
        random_provider_code(rng),
        last,
        first,
        addr1,
        addr2,
        zip_,
        phone,
        "008",
        "",
        str(client_local_id),
        middle,
        "",
    ]
    return "|".join(q(f) for f in fields)


def format_size(num_bytes: float) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if num_bytes < 1024:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024
    return f"{num_bytes:.1f} PB"


def generate(output_path: str, target_bytes: int, seed: Optional[int], batch_size: int) -> None:
    rng = random.Random(seed)
    written = 0
    row_count = 0
    client_local_id = 1
    start = time.time()
    last_print = 0.0

    with open(output_path, "w", encoding="utf-8", newline="\n") as f:
        header_line = HEADER + "\n"
        f.write(header_line)
        written += len(header_line.encode("utf-8"))

        buffer = []
        buffer_bytes = 0

        while written < target_bytes:
            line = build_row(rng, client_local_id) + "\n"
            buffer.append(line)
            buffer_bytes += len(line.encode("utf-8"))
            client_local_id += 1
            row_count += 1

            if len(buffer) >= batch_size:
                f.write("".join(buffer))
                written += buffer_bytes
                buffer.clear()
                buffer_bytes = 0

                now = time.time()
                if now - last_print > 0.2:  # no saturar la terminal con prints
                    elapsed = now - start
                    pct = min(100.0, written / target_bytes * 100)
                    speed = (written / elapsed / (1024 * 1024)) if elapsed > 0 else 0
                    print(f"\r{pct:5.1f}%  {format_size(written)} / {format_size(target_bytes)}  "
                          f"({row_count:,} filas, {speed:.1f} MB/s)", end="", flush=True)
                    last_print = now

        if buffer:
            f.write("".join(buffer))
            written += buffer_bytes

    elapsed = time.time() - start
    print(f"\n\nListo: {output_path}")
    print(f"Tamaño final: {format_size(written)}  |  Filas: {row_count:,}  |  Tiempo: {elapsed:.1f}s")


def parse_args():
    p = argparse.ArgumentParser(
        description="Genera un archivo mock .txt con estructura pipe-delimited / quoted"
    )
    p.add_argument("-o", "--output", default="mock_data.txt",
                   help="Ruta del archivo de salida (default: mock_data.txt)")
    p.add_argument("-g", "--size-gb", type=float, required=True,
                   help="Tamaño objetivo en GB (ej: 11, 0.5)")
    p.add_argument("--seed", type=int, default=None,
                   help="Semilla para reproducibilidad (opcional)")
    p.add_argument("--batch-size", type=int, default=5000,
                   help="Filas por lote de escritura (default: 5000)")
    return p.parse_args()


def main():
    args = parse_args()
    target_bytes = int(args.size_gb * 1024 ** 3)
    generate(args.output, target_bytes, args.seed, args.batch_size)


if __name__ == "__main__":
    main()