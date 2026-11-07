import test from "node:test";import assert from "node:assert/strict";
import {parseAddresses,resultsCSV} from "./location/csv.js";
test("CSV handles quoted addresses, escaped quotes, country and BOM",()=>{assert.deepEqual(parseAddresses('\uFEFFaddress,country\r\n"Larco, Miraflores",pe\r\n"Local ""A""",CO'),[{id:"1",query:"Larco, Miraflores",countrycodes:"PE"},{id:"2",query:'Local "A"',countrycodes:"CO"}]);});
test("CSV rejects malformed input and unsafe sizes",()=>{for(const value of ['name\na','address\n"unclosed','address,country\nLima,PER','address\na'])assert.throws(()=>parseAddresses(value));assert.throws(()=>parseAddresses('x'.repeat(1024*1024+1)));});
test("CSV export neutralizes spreadsheet formulas",()=>{const result=resultsCSV([{id:"1",query:"=SUM(1,2)",status:"ok",result:{latitude:0,longitude:-77}}]);assert.ok(result.includes("'=SUM"));assert.ok(result.includes('"0"'));});
