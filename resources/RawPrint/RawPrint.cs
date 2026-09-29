// Build with .NET Framework 4.7.2 on Windows: csc /target:exe /out:RawPrint.exe RawPrint.cs
using System; using System.IO; using System.Runtime.InteropServices; using System.Text;
partial class RawPrint {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)] class DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
 [DllImport("winspool.Drv", CharSet=CharSet.Ansi, SetLastError=true)] static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
 [DllImport("winspool.Drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv", CharSet=CharSet.Ansi, SetLastError=true)] static extern int StartDocPrinter(IntPtr h,int l,DOCINFOA d);
 [DllImport("winspool.Drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr h); [DllImport("winspool.Drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr h); [DllImport("winspool.Drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv", SetLastError=true)] static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] class JOB_INFO_1 { public int JobId; [MarshalAs(UnmanagedType.LPWStr)] public string pPrinterName; [MarshalAs(UnmanagedType.LPWStr)] public string pMachineName; [MarshalAs(UnmanagedType.LPWStr)] public string pUserName; [MarshalAs(UnmanagedType.LPWStr)] public string pDocument; [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype; [MarshalAs(UnmanagedType.LPWStr)] public string pStatus; public int Status; public int Priority; public int Position; public int TotalPages; public int PagesPrinted; public SYSTEMTIME Submitted; }
 [StructLayout(LayoutKind.Sequential)] struct SYSTEMTIME { public ushort Year, Month, DayOfWeek, Day, Hour, Minute, Second, Milliseconds; }
 [DllImport("winspool.Drv", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumJobs(IntPtr h, int firstJob, int noJobs, int level, IntPtr pJob, int cbBuf, out int needed, out int returned);
 [DllImport("winspool.Drv", SetLastError=true)] static extern bool SetJob(IntPtr h, int jobId, int level, IntPtr pJob, int command);
 const int JOB_CONTROL_PAUSE=1, JOB_CONTROL_RESUME=2, JOB_CONTROL_CANCEL=3;
 static int Main(string[] a) {
  if(a.Length==2 && (a[0]=="--preferences" || a[0]=="--apply-preferences" || a[0]=="--reset-preferences")) {
   Console.OutputEncoding=new System.Text.UTF8Encoding(false);
   try { Preferences(a[1], a[0]); return 0; }
   catch(Exception e) { Console.Error.Write(e.Message); return 1; }
  }
  if(a.Length==2 && a[0]=="--printer") return PrintRaw(a[1]);
  if(a.Length==2 && a[0]=="--jobs") return Jobs(a[1]);
  if(a.Length==3 && a[0]=="--job") return Control(a[1],a[2]);
  return 64;
 }
 static int PrintRaw(string printer) { byte[] bytes; using(var ms=new MemoryStream()){Console.OpenStandardInput().CopyTo(ms);bytes=ms.ToArray();} IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero))return 2; try { var d=new DOCINFOA{pDocName="Mirocab ESC/POS",pDataType="RAW"}; if(StartDocPrinter(h,1,d)==0||!StartPagePrinter(h))return 3; int w; if(!WritePrinter(h,bytes,bytes.Length,out w)||w!=bytes.Length)return 4; return EndPagePrinter(h)&&EndDocPrinter(h)?0:5; } finally {ClosePrinter(h);} }
 static int Jobs(string printer) { IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero)) return 2; try { int needed, returned; EnumJobs(h,0,999,1,IntPtr.Zero,0,out needed,out returned); if(needed==0) { Console.Write("[]"); return 0; } IntPtr buffer=Marshal.AllocHGlobal(needed); try { if(!EnumJobs(h,0,999,1,buffer,needed,out needed,out returned))return 3; var sb=new StringBuilder("["); int size=Marshal.SizeOf(typeof(JOB_INFO_1)); for(int i=0;i<returned;i++){ var job=(JOB_INFO_1)Marshal.PtrToStructure(new IntPtr(buffer.ToInt64()+i*size),typeof(JOB_INFO_1)); if(i>0)sb.Append(','); sb.Append("{\\\"id\\\":").Append(job.JobId).Append(",\\\"document\\\":\\\"").Append(Escape(job.pDocument)).Append("\\\",\\\"user\\\":\\\"").Append(Escape(job.pUserName)).Append("\\\",\\\"status\\\":").Append(job.Status).Append(",\\\"statusText\\\":\\\"").Append(Escape(job.pStatus)).Append("\\\",\\\"totalPages\\\":").Append(job.TotalPages).Append(",\\\"pagesPrinted\\\":").Append(job.PagesPrinted).Append('}'); } sb.Append(']'); Console.Write(sb.ToString()); return 0; } finally { Marshal.FreeHGlobal(buffer); } } finally {ClosePrinter(h);} }
 static int Control(string printer, string operation) { var parts=operation.Split(':'); int id; if(parts.Length!=2||!Int32.TryParse(parts[1],out id))return 64; int command=parts[0]=="pause"?JOB_CONTROL_PAUSE:parts[0]=="resume"?JOB_CONTROL_RESUME:parts[0]=="cancel"?JOB_CONTROL_CANCEL:0; if(command==0)return 64; IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero))return 2; try { return SetJob(h,id,0,IntPtr.Zero,command)?0:3; } finally {ClosePrinter(h);} }
 static string Escape(string value) { return (value??"").Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r","\\r").Replace("\n","\\n"); }
}
