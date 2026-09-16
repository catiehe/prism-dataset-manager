#!/usr/bin/env python3
"""
Export a PRISM LCA "Model" (a product graph from the LCA MCP's list_product_graphs,
already loaded into the Supabase `datasets` table) as an EcoSpold v2 XML file.

Usage:
    python3 scripts/export_ecospold.py "Jacket — 1 unit (3-tier)"
    python3 scripts/export_ecospold.py --list
    python3 scripts/export_ecospold.py --all --out-dir dist/ecospold

Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (the datasets table
has a public-read RLS policy, so the anon key is sufficient — no service role key
needed). No third-party packages required; stdlib only.

Produces one EcoSpold v2 <ecoSpold> XML document per model, with one
<activityDataset> per process in the graph. Intermediate exchanges that consume
another process's reference product within the same graph are linked explicitly
via the `activityLinkId` attribute (EcoSpold v2's process-linking mechanism),
mirroring the model's process-instance graph.

Notes on fidelity / limitations:
  - UUIDs for master-data references (activityNameId, geographyId, unitId,
    intermediateExchangeId, elementaryExchangeId) are generated deterministically
    (uuid5) from this app's own dataset IDs. They are internally consistent but do
    NOT match ecoinvent's official central master-data registry — this produces a
    schema-valid, standalone dataset, not one pre-linked into the ecoinvent database.
  - Elementary flow compartments are inferred from a small fixed lookup (the
    substances the bundled product graphs actually use); an unrecognized
    elementary flow name falls back to compartment "air" / subcompartment
    "unspecified" and prints a warning.
"""
import argparse
import json
import os
import sys
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ES = "http://www.EcoInvent.org/EcoSpold02"
XML_NS = "http://www.w3.org/XML/1998/namespace"
ET.register_namespace("", ES)

NS_ROOT = uuid.UUID("6f1c6b1a-2b3a-4a3e-8b0a-1c2d3e4f5a6b")  # fixed, arbitrary export namespace


def load_env(repo_root):
    env_path = os.path.join(repo_root, ".env")
    values = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip()
    return values


def fetch_datasets(supabase_url, anon_key):
    url = f"{supabase_url}/rest/v1/datasets?select=id,type,name,payload"
    req = urllib.request.Request(url, headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def uid5(*parts):
    return str(uuid.uuid5(NS_ROOT, "|".join(parts)))


# Elementary-flow name -> (compartment, subcompartment)
COMPARTMENTS = {
    "Ammonia": ("air", "unspecified"),
    "Carbon dioxide": ("air", "unspecified"),
    "Methane": ("air", "unspecified"),
    "Nitrogen oxides": ("air", "unspecified"),
    "Nitrous oxide": ("air", "unspecified"),
    "Water": ("natural resource", "in water"),
}

# Item(s)/Transport-service/Mass/Volume flow property name -> canonical unit name
FLOW_PROPERTY_UNIT = {"Mass": "kg", "Volume": "L", "Item(s)": "unit", "Transport service": "tkm"}


def sub(parent, tag, text=None, **attrs):
    el = ET.SubElement(parent, f"{{{ES}}}{tag}")
    for k, v in attrs.items():
        el.set(k, str(v))
    if text is not None:
        el.text = text
    return el


def lang_el(parent, tag, text, lang="en", **attrs):
    el = sub(parent, tag, text, **attrs)
    el.set(f"{{{XML_NS}}}lang", lang)
    return el


def text_and_image(parent, tag, text):
    el = sub(parent, tag)
    lang_el(el, "text", text, index=1)
    return el


class GraphExporter:
    def __init__(self, rows):
        self.by_id = {r["id"]: r for r in rows}
        self.flows = [r for r in rows if r["type"] == "flow"]
        self.models = [r for r in rows if r["type"] == "model"]
        self.processes = [r for r in rows if r["type"] == "process"]
        self.warned_flows = set()

    def find_model(self, name):
        for m in self.models:
            if m["name"] == name:
                return m
        return None

    def resolve_flow(self, flow_ref):
        fid = flow_ref.get("refObjectId")
        return self.by_id.get(fid)

    def flow_unit(self, flow_row):
        fp_ref = flow_row["payload"]["flowProperties"][0]["referenceToFlowPropertyDataSet"]
        fp_name = fp_ref.get("shortDescription", "Mass")
        return FLOW_PROPERTY_UNIT.get(fp_name, "kg")

    def compartment_for(self, flow_name):
        if flow_name in COMPARTMENTS:
            return COMPARTMENTS[flow_name]
        if flow_name not in self.warned_flows:
            print(f"  warning: no compartment mapping for elementary flow '{flow_name}', "
                  f"defaulting to air/unspecified", file=sys.stderr)
            self.warned_flows.add(flow_name)
        return ("air", "unspecified")

    def build_activity_dataset(self, process_row, ref_flow_id_to_activity_id):
        p = process_row["payload"]
        activity_id = uid5("process", process_row["id"])
        di = p["processInformation"]["dataSetInformation"]
        name = di["name"]["baseName"][0]["text"] if di["name"]["baseName"] else process_row["name"]
        comment = di["generalComment"][0]["text"] if di.get("generalComment") else ""

        ds = ET.Element(f"{{{ES}}}activityDataset")

        desc = sub(ds, "activityDescription")
        activity = sub(desc, "activity", id=activity_id,
                       activityNameId=uid5("activityName", process_row["id"]),
                       type=1, specialActivityType=0)
        lang_el(activity, "activityName", name)
        if comment:
            text_and_image(activity, "generalComment", comment)

        geography = sub(desc, "geography", geographyId=uid5("geo", "GLO"))
        lang_el(geography, "shortname", "GLO")

        sub(desc, "technology", technologyLevel=3)

        sub(desc, "timePeriod", startDate="2026-01-01", endDate="2026-12-31",
            isDataValidForEntirePeriod="true")

        scenario = sub(desc, "macroEconomicScenario", macroEconomicScenarioId=uid5("scenario", "business-as-usual"))
        lang_el(scenario, "name", "Business-as-Usual")

        flow_data = sub(ds, "flowData")
        for ex in p["exchanges"]:
            flow_row = self.resolve_flow(ex["referenceToFlowDataSet"])
            if flow_row is None:
                print(f"  warning: skipping exchange with unresolved flow "
                      f"'{ex['referenceToFlowDataSet'].get('shortDescription')}' "
                      f"in process '{process_row['name']}'", file=sys.stderr)
                continue
            flow_type = flow_row["payload"]["modellingAndValidation"]["typeOfDataSet"]
            unit_name = self.flow_unit(flow_row)
            unit_id = uid5("unit", unit_name)
            is_input = ex["exchangeDirection"] == "Input"
            is_qref = bool(p["processInformation"]["quantitativeReference"]["referenceToReferenceFlow"] == ex["dataSetInternalID"])
            exchange_id = uid5("exchange", process_row["id"], str(ex["dataSetInternalID"]))

            if flow_type == "Elementary flow":
                el = sub(flow_data, "elementaryExchange",
                         elementaryExchangeId=uid5("elem_flow", flow_row["id"]),
                         id=exchange_id, unitId=unit_id, amount=ex["meanAmount"])
                lang_el(el, "name", flow_row["name"])
                lang_el(el, "unitName", unit_name)
                compartment, subcompartment = self.compartment_for(flow_row["name"])
                comp_el = sub(el, "compartment", subcompartmentId=uid5("subcompartment", compartment, subcompartment))
                lang_el(comp_el, "compartment", compartment)
                lang_el(comp_el, "subcompartment", subcompartment)
                sub(el, "inputGroup" if is_input else "outputGroup", text="4")
            else:
                attrs = {
                    "intermediateExchangeId": uid5("intermediate_flow", flow_row["id"]),
                    "id": exchange_id, "unitId": unit_id, "amount": ex["meanAmount"],
                }
                if is_input:
                    supplier_activity_id = ref_flow_id_to_activity_id.get(flow_row["id"])
                    if supplier_activity_id and supplier_activity_id != activity_id:
                        attrs["activityLinkId"] = supplier_activity_id
                el = sub(flow_data, "intermediateExchange", **attrs)
                lang_el(el, "name", flow_row["name"])
                lang_el(el, "unitName", unit_name)
                if is_input:
                    sub(el, "inputGroup", text="5")
                else:
                    sub(el, "outputGroup", text="0" if is_qref else "2")

        sub(ds, "modellingAndValidation")

        admin = sub(ds, "administrativeInformation")
        person_id = uid5("person", "export-utility")
        sub(admin, "dataEntryBy", personId=person_id, personName="PRISM LCA export utility",
            personEmail="noreply@lca-mcp.mathplosion.com")
        sub(admin, "dataGeneratorAndPublication", personId=person_id,
            personName="PRISM LCA export utility", personEmail="noreply@lca-mcp.mathplosion.com",
            dataPublishedIn=0, isCopyrightProtected="false", accessRestrictedTo=0)
        sub(admin, "fileAttributes", majorRelease=1, minorRelease=0, majorRevision=1, minorRevision=1,
            defaultLanguage="en", fileGenerator="prism-dataset-manager/scripts/export_ecospold.py",
            fileTimestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))

        return activity_id, ds

    def export_model(self, model_row):
        instances = model_row["payload"]["processInstances"]
        process_rows = []
        for inst in instances:
            pid = inst["referenceToProcess"]["refObjectId"]
            proc = self.by_id.get(pid)
            if proc is None:
                print(f"  warning: model '{model_row['name']}' references missing process {pid}", file=sys.stderr)
                continue
            process_rows.append(proc)

        # Map: flow id (of a process's reference product) -> that process's activity id,
        # so inputs consuming it elsewhere in the graph can be linked via activityLinkId.
        ref_flow_id_to_activity_id = {}
        for proc in process_rows:
            activity_id = uid5("process", proc["id"])
            p = proc["payload"]
            qref_internal_id = p["processInformation"]["quantitativeReference"]["referenceToReferenceFlow"]
            for ex in p["exchanges"]:
                if ex["dataSetInternalID"] == qref_internal_id and ex["exchangeDirection"] == "Output":
                    flow_row = self.resolve_flow(ex["referenceToFlowDataSet"])
                    if flow_row:
                        ref_flow_id_to_activity_id[flow_row["id"]] = activity_id

        root = ET.Element(f"{{{ES}}}ecoSpold")
        for proc in process_rows:
            _, ds = self.build_activity_dataset(proc, ref_flow_id_to_activity_id)
            root.append(ds)
        return root


def slugify(name):
    return "".join(c if c.isalnum() else "_" for c in name).strip("_").lower()


def write_xml(root, out_path):
    ET.indent(root, space="  ")
    tree = ET.ElementTree(root)
    tree.write(out_path, encoding="utf-8", xml_declaration=True, default_namespace=None)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model_name", nargs="?", help="Exact name of a Model row, e.g. 'Jacket — 1 unit (3-tier)'")
    parser.add_argument("--list", action="store_true", help="List available model names and exit")
    parser.add_argument("--all", action="store_true", help="Export every model")
    parser.add_argument("--out-dir", default=".", help="Directory to write the .xml file(s) into")
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = load_env(repo_root)
    supabase_url = env.get("VITE_SUPABASE_URL")
    anon_key = env.get("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not anon_key:
        sys.exit("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in .env")

    rows = fetch_datasets(supabase_url, anon_key)
    exporter = GraphExporter(rows)

    if args.list:
        for m in exporter.models:
            print(m["name"])
        return

    targets = exporter.models if args.all else None
    if targets is None:
        if not args.model_name:
            sys.exit("Pass a model name, or --list, or --all. See --help.")
        model = exporter.find_model(args.model_name)
        if model is None:
            sys.exit(f"No model named '{args.model_name}'. Run with --list to see options.")
        targets = [model]

    os.makedirs(args.out_dir, exist_ok=True)
    for model in targets:
        root = exporter.export_model(model)
        out_path = os.path.join(args.out_dir, f"{slugify(model['name'])}.ecospold2.xml")
        write_xml(root, out_path)
        n = len(root)
        print(f"wrote {out_path} ({n} activityDataset{'s' if n != 1 else ''})")


if __name__ == "__main__":
    main()
