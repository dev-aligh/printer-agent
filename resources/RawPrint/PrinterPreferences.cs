using System;
using System.ComponentModel;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Collections.Generic;

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
 class PaperDescription {
  public string orientation { get; set; }
  public double widthMm { get; set; }
  public double heightMm { get; set; }
  public string paperName { get; set; }
 }

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
 static bool SameSize(double width, double height, double expectedWidth, double expectedHeight) {
  return Math.Abs(width-expectedWidth)<=1 && Math.Abs(height-expectedHeight)<=1;
 }
 static PaperSize SelectPaper(IEnumerable<PaperSize> papers, double width, double height) {
  foreach(var paper in papers)
   if(SameSize(paper.Width*0.254,paper.Height*0.254,width,height)) return paper;
  return null;
 }
 static void RequestedDimensions(PreferenceInput input, out double width, out double height) {
  if(input.paper=="A5") { width=148; height=210; return; }
  if(input.paper=="thermal-58") width=58;
  else if(input.paper=="thermal-80") width=80;
  else if(input.paper=="custom-roll") width=input.rollWidthMm;
  else throw new Exception("Invalid paper type.");
  height=input.rollHeightMm;
  if(width<30 || width>220 || height<20 || height>1000 || Double.IsNaN(width) || Double.IsNaN(height)) throw new Exception("Invalid paper dimensions.");
 }
 static PaperDescription DescribeMode(IntPtr mode, IEnumerable<PaperSize> papers, PaperSize fallback) {
  int fields=Marshal.ReadInt32(mode,Fields);
  int code=(ushort)Marshal.ReadInt16(mode,Paper);
  PaperSize selected=null;
  if((fields&2)!=0 && code!=0)
   foreach(var paper in papers) if(paper.RawKind==code) { selected=paper; break; }
  // Resolve the driver's own paper code before falling back to PageSettings,
  // which may otherwise describe the queue's default paper.
  double width=(selected??fallback).Width*0.254, height=(selected??fallback).Height*0.254;
  double reportedWidth=width, reportedHeight=height;
  if((fields&8)!=0 && Marshal.ReadInt16(mode,Width)>0) reportedWidth=Marshal.ReadInt16(mode,Width)/10.0;
  if((fields&4)!=0 && Marshal.ReadInt16(mode,Length)>0) reportedHeight=Marshal.ReadInt16(mode,Length)/10.0;
  // Recognize landscape dimensions only when they match the advertised form
  // exactly after rotation. A genuinely different custom size must not pass.
  bool rotated=selected!=null && Marshal.ReadInt16(mode,Orientation)==2 && SameSize(reportedWidth,reportedHeight,height,width);
  if(!rotated) { width=reportedWidth; height=reportedHeight; }
  return new PaperDescription { orientation=Marshal.ReadInt16(mode,Orientation)==2?"landscape":"portrait", widthMm=width, heightMm=height, paperName=(selected??fallback).PaperName };
 }
 static PaperDescription Describe(string printer, IntPtr mode) {
  var settings=new PrinterSettings(); settings.PrinterName=printer;
  var page=new PageSettings(settings); page.SetHdevmode(mode);
  var papers=new List<PaperSize>();
  foreach(PaperSize paper in settings.PaperSizes) papers.Add(paper);
  return DescribeMode(mode,papers,page.PaperSize);
 }
 static void ConfigureMode(IntPtr mode, PreferenceInput input, PaperSize paper, double width, double height) {
  int fields=Marshal.ReadInt32(mode,Fields);
  fields &= ~0x10000;
  fields |= 1;
  // Named paper and explicit dimensions are alternative selection modes.
  // Do not mark dmPaperSize as supplied when its value is zero (custom size).
  if(paper!=null) { fields |= 2; fields &= ~(4|8); }
  else { fields &= ~2; fields |= 4|8; }
  Marshal.WriteInt32(mode,Fields,fields);
  Marshal.WriteInt16(mode,Orientation,(short)(input.orientation=="landscape"?2:1));
  Marshal.WriteInt16(mode,Paper,(short)(paper==null?0:paper.RawKind));
  // Do not send competing custom dimensions with a driver-advertised form.
  Marshal.WriteInt16(mode,Width,paper==null?(short)Math.Round(width*10):(short)0);
  Marshal.WriteInt16(mode,Length,paper==null?(short)Math.Round(height*10):(short)0);
  // dmFormName starts at byte 102 and contains 32 UTF-16 characters.
  for(int i=0;i<32;i++) Marshal.WriteInt16(mode,102+i*2,0);
 }
 static void ValidateAccepted(PaperDescription actual, PreferenceInput input, double width, double height) {
  if(actual.orientation!=input.orientation || !SameSize(actual.widthMm,actual.heightMm,width,height))
   throw new Exception(String.Format(System.Globalization.CultureInfo.InvariantCulture,
    "Printer driver does not support the requested settings. Requested: {0} x {1} mm, {2}; driver returned: {3} ({4:0.##} x {5:0.##} mm), {6}. Check the printer's paper/tray settings.",
    width,height,input.orientation,actual.paperName,actual.widthMm,actual.heightMm,actual.orientation));
 }
 static bool AcceptedSize(PaperDescription actual, PreferenceInput input, double width, double height) {
  return actual.orientation==input.orientation && SameSize(actual.widthMm,actual.heightMm,width,height);
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
    double width,height;
    RequestedDimensions(input,out width,out height);
    var printerSettings=new PrinterSettings(); printerSettings.PrinterName=printer;
    var papers=new List<PaperSize>();
    foreach(PaperSize supported in printerSettings.PaperSizes) papers.Add(supported);
    var paper=SelectPaper(papers,width,height);
    // A5 is always a named sheet, even if the driver omits it from its list.
    // Let the driver validate standard A5; never fall back to custom-roll fields.
    if(paper==null && input.paper=="A5") { paper=new PaperSize("A5",583,827); paper.RawKind=11; }
    int size=DocumentProperties(IntPtr.Zero,handle,printer,IntPtr.Zero,IntPtr.Zero,0);
    if(size<166) throw new Exception("Cannot read printer driver settings (DocumentProperties="+size+", Windows="+Marshal.GetLastWin32Error()+").");
    mode=Marshal.AllocHGlobal(size);
    IntPtr current=ReadMode(handle,9);
    if(current==IntPtr.Zero) current=ReadMode(handle,8);
    try {
     if(DocumentProperties(IntPtr.Zero,handle,printer,mode,current,current==IntPtr.Zero?2:10)!=1) throw new Exception("Cannot load printer driver settings.");
    } finally { if(current!=IntPtr.Zero) Marshal.FreeHGlobal(current); }
    // Keep a pristine driver mode: a failed negotiation can rewrite private
    // fields as well as public dimensions. Never retry from that rejected mode.
    byte[] baseline=new byte[size]; Marshal.Copy(mode,baseline,0,size);
    ConfigureMode(mode,input,paper,width,height);
    int negotiated=DocumentProperties(IntPtr.Zero,handle,printer,mode,mode,10);
    if(paper!=null && (negotiated!=1 || !AcceptedSize(Describe(printer,mode),input,width,height))) {
     // Some drivers keep Letter dimensions when given only an A5 form code.
     // Negotiate the exact requested physical dimensions without a competing
     // named-paper selection. Only persist if the driver actually accepts them.
     Marshal.Copy(baseline,0,mode,size);
     ConfigureMode(mode,input,null,width,height);
     negotiated=DocumentProperties(IntPtr.Zero,handle,printer,mode,mode,10);
    }
    if(negotiated!=1) throw new Exception("Printer driver rejected the settings.");
    // Do not report success when a driver silently substitutes another paper.
    ValidateAccepted(Describe(printer,mode),input,width,height);
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
