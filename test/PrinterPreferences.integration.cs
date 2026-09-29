// Builds alongside the production helper with /main:PreferenceTestEntry.
// Uses the PDF queue only, restoring its complete DEVMODE in finally.
using System;
using System.IO;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Runtime.InteropServices;
class PreferenceTestEntry { static int Main() { try { RawPrint.TestPreferences(); return 0; } catch(Exception e) { Console.Error.WriteLine(e); return 1; } } }
partial class RawPrint {
 public static void TestPreferences() {
  const string printer="Microsoft Print to PDF";
  IntPtr handle; Check(OpenPreferencesPrinter(printer,out handle,IntPtr.Zero));
  IntPtr original=ReadMode(handle,9);
  if(original==IntPtr.Zero) original=ReadMode(handle,8);
  if(original==IntPtr.Zero) { ClosePrinter(handle); throw new Exception("No snapshot; refusing to modify test queue."); }
  var json=new JavaScriptSerializer();
  var before=new Dictionary<string,string>();
  foreach(string other in System.Drawing.Printing.PrinterSettings.InstalledPrinters)
   if(other!=printer) before[other]=InvokePreferences(other,"--preferences","");
  try {
   string applied=InvokePreferences(printer,"--apply-preferences","{\"paper\":\"A5\",\"orientation\":\"landscape\"}");
   var data=json.Deserialize<Dictionary<string,object>>(applied);
   if((string)data["orientation"]!="landscape" || Math.Abs(Convert.ToDouble(data["widthMm"])-148)>1 || Math.Abs(Convert.ToDouble(data["heightMm"])-210)>1) throw new Exception("Apply/readback mismatch: "+applied);
   string read=InvokePreferences(printer,"--preferences","");
   if(applied!=read) throw new Exception("Preference did not persist.");
   string reset=InvokePreferences(printer,"--reset-preferences","");
   IntPtr global=ReadMode(handle,8);
   try { if(reset!=json.Serialize(Describe(printer,global))) throw new Exception("Reset did not restore queue defaults."); }
   finally { Marshal.FreeHGlobal(global); }
   bool rejected=false;
   try { InvokePreferences(printer,"--apply-preferences","{\"paper\":\"custom-roll\",\"orientation\":\"portrait\",\"rollWidthMm\":0,\"rollHeightMm\":130}"); } catch { rejected=true; }
   if(!rejected || reset!=InvokePreferences(printer,"--preferences","")) throw new Exception("Invalid request changed settings.");
   bool customAccepted=false;
   try {
    var custom=json.Deserialize<Dictionary<string,object>>(InvokePreferences(printer,"--apply-preferences","{\"paper\":\"thermal-80\",\"orientation\":\"portrait\",\"rollHeightMm\":130}"));
    customAccepted=true;
    if(Math.Abs(Convert.ToDouble(custom["widthMm"])-80)>1 || Math.Abs(Convert.ToDouble(custom["heightMm"])-130)>1) throw new Exception("Custom roll mismatch.");
   } catch(Exception error) {
    if(customAccepted || !error.Message.Contains("does not support")) throw;
    if(reset!=InvokePreferences(printer,"--preferences","")) throw new Exception("Rejected roll changed preferences.");
   }
   Console.WriteLine(customAccepted?"PASS: custom roll accepted and verified.":"PASS: unsupported roll rejected without changing preferences.");
   foreach(var other in before) if(other.Value!=InvokePreferences(other.Key,"--preferences","")) throw new Exception("Other printer changed: "+other.Key);
   Console.WriteLine("PASS: A5 landscape persisted; reset matches driver defaults; invalid input rejected; other queues unchanged.");
  } finally { try { WriteMode(handle,original); } finally { Marshal.FreeHGlobal(original); ClosePrinter(handle); } }
  Console.WriteLine("Original PDF preferences restored.");
 }
 static string InvokePreferences(string printer,string action,string input) {
  TextReader oldIn=Console.In; TextWriter oldOut=Console.Out;
  var output=new StringWriter();
  try { Console.SetIn(new StringReader(input)); Console.SetOut(output); Preferences(printer,action); return output.ToString(); }
  finally { Console.SetIn(oldIn); Console.SetOut(oldOut); }
 }
}
