using System;
using System.ComponentModel;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

partial class RawPrint {
 [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
 static extern bool OpenPreferencesPrinter(string name, out IntPtr handle, IntPtr defaults);
 [DllImport("winspool.drv", EntryPoint="GetPrinterW", SetLastError=true)]
 static extern bool GetPreferences(IntPtr handle, int level, IntPtr data, int size, out int needed);
 [DllImport("winspool.drv", EntryPoint="SetPrinterW", SetLastError=true)]
 static extern bool SetPreferences(IntPtr handle, int level, IntPtr data, int command);
 [DllImport("winspool.drv", EntryPoint="DocumentPropertiesW", CharSet=CharSet.Unicode, SetLastError=true)]
 static extern int DocumentProperties(IntPtr window, IntPtr handle, string name, IntPtr output, IntPtr input, int mode);
 public class PreferenceInput { public string paper { get; set; } public string orientation { get; set; } public double rollWidthMm { get; set; } public double rollHeightMm { get; set; } }

 // DEVMODEW public-header offsets. The allocation includes all private driver data.
 const int Fields=72, Orientation=76, Paper=78, Length=80, Width=82;
 static void Check(bool ok) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
 static IntPtr ReadMode(IntPtr handle, int level) {
  int needed;
  GetPreferences(handle, level, IntPtr.Zero, 0, out needed);
  if(needed<=0) throw new Win32Exception(Marshal.GetLastWin32Error());
  IntPtr info=Marshal.AllocHGlobal(needed);
  try {
   Check(GetPreferences(handle, level, info, needed, out needed));
   IntPtr mode=Marshal.ReadIntPtr(info);
   if(mode==IntPtr.Zero) return IntPtr.Zero;
   int size=(ushort)Marshal.ReadInt16(mode,68)+(ushort)Marshal.ReadInt16(mode,70);
   if(size<84) throw new Exception("Invalid printer DEVMODE.");
   byte[] bytes=new byte[size]; Marshal.Copy(mode,bytes,0,size);
   IntPtr copy=Marshal.AllocHGlobal(size); Marshal.Copy(bytes,0,copy,size); return copy;
  } finally { Marshal.FreeHGlobal(info); }
 }
 static void WriteMode(IntPtr handle, IntPtr mode) {
  IntPtr info=Marshal.AllocHGlobal(IntPtr.Size);
  try { Marshal.WriteIntPtr(info,mode); Check(SetPreferences(handle,9,info,0)); }
  finally { Marshal.FreeHGlobal(info); }
 }
 static object Describe(string printer, IntPtr mode) {
  var settings=new PrinterSettings(); settings.PrinterName=printer;
  var page=new PageSettings(settings); page.SetHdevmode(mode);
  int fields=Marshal.ReadInt32(mode,Fields);
  double width=page.PaperSize.Width*0.254, height=page.PaperSize.Height*0.254;
  if((fields&8)!=0 && Marshal.ReadInt16(mode,Width)>0) width=Marshal.ReadInt16(mode,Width)/10.0;
  if((fields&4)!=0 && Marshal.ReadInt16(mode,Length)>0) height=Marshal.ReadInt16(mode,Length)/10.0;
  return new { orientation=Marshal.ReadInt16(mode,Orientation)==2?"landscape":"portrait", widthMm=width, heightMm=height, paperName=page.PaperSize.PaperName };
 }
 static void Preferences(string printer, string action) {
  IntPtr handle; Check(OpenPreferencesPrinter(printer,out handle,IntPtr.Zero));
  IntPtr mode=IntPtr.Zero;
  try {
   var json=new JavaScriptSerializer();
   if(action=="--reset-preferences") {
    // Restore this queue's administrator/driver defaults, not another queue's settings.
    mode=ReadMode(handle,8);
    if(mode==IntPtr.Zero) throw new Exception("Printer defaults are unavailable.");
    WriteMode(handle,mode);
   } else if(action=="--apply-preferences") {
    var input=json.Deserialize<PreferenceInput>(Console.In.ReadToEnd());
    if(input==null || (input.orientation!="portrait" && input.orientation!="landscape")) throw new Exception("Invalid orientation.");
    bool a5=input.paper=="A5";
    double width=a5?148:input.paper=="thermal-58"?58:input.paper=="thermal-80"?80:input.rollWidthMm;
    double height=a5?210:input.rollHeightMm;
    if(width<30 || width>220 || height<20 || height>1000 || Double.IsNaN(width) || Double.IsNaN(height)) throw new Exception("Invalid paper dimensions.");
    int paperCode=a5?11:0;
    if(!a5) {
     var printerSettings=new PrinterSettings(); printerSettings.PrinterName=printer;
     foreach(PaperSize supported in printerSettings.PaperSizes)
      if(Math.Abs(supported.Width*0.254-width)<0.5 && Math.Abs(supported.Height*0.254-height)<0.5) { paperCode=supported.RawKind; break; }
    }
    int size=DocumentProperties(IntPtr.Zero,handle,printer,IntPtr.Zero,IntPtr.Zero,0);
    if(size<84) throw new Exception("Cannot read printer driver settings (DocumentProperties="+size+", Windows="+Marshal.GetLastWin32Error()+").");
    mode=Marshal.AllocHGlobal(size);
    if(DocumentProperties(IntPtr.Zero,handle,printer,mode,IntPtr.Zero,2)!=1) throw new Exception("Cannot load printer driver settings.");
    int fields=Marshal.ReadInt32(mode,Fields);
    // Clear form-name selection so it cannot override the requested paper size.
    fields &= ~0x10000;
    fields |= 1|2;
    if(paperCode!=0) fields &= ~(4|8); else fields |= 4|8;
    Marshal.WriteInt32(mode,Fields,fields);
    Marshal.WriteInt16(mode,Orientation,(short)(input.orientation=="landscape"?2:1));
    Marshal.WriteInt16(mode,Paper,(short)paperCode);
    Marshal.WriteInt16(mode,Width,(short)Math.Round(width*10));
    Marshal.WriteInt16(mode,Length,(short)Math.Round(height*10));
    if(DocumentProperties(IntPtr.Zero,handle,printer,mode,mode,10)!=1) throw new Exception("Printer driver rejected the settings.");
    // Do not report success when a driver silently substitutes another paper.
    var accepted=json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(json.Serialize(Describe(printer,mode)));
    if((string)accepted["orientation"]!=input.orientation || Math.Abs(Convert.ToDouble(accepted["widthMm"])-width)>1 || Math.Abs(Convert.ToDouble(accepted["heightMm"])-height)>1)
     throw new Exception("Printer driver does not support this paper size or orientation. Select a supported size in printer preferences.");
    WriteMode(handle,mode);
   }
   if(mode!=IntPtr.Zero) { Marshal.FreeHGlobal(mode); mode=IntPtr.Zero; }
   mode=ReadMode(handle,9);
   if(mode==IntPtr.Zero) mode=ReadMode(handle,8);
   if(mode==IntPtr.Zero) throw new Exception("Printer preferences are unavailable.");
   Console.Write(json.Serialize(Describe(printer,mode)));
  } finally { if(mode!=IntPtr.Zero) Marshal.FreeHGlobal(mode); ClosePrinter(handle); }
 }
}
