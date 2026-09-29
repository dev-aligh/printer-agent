using System;
using System.Drawing.Printing;
using System.Runtime.InteropServices;

class PaperModeTestEntry {
 static int Main() {
  try { RawPrint.TestPaperModes(); return 0; }
  catch(Exception error) { Console.Error.WriteLine(error); return 1; }
 }
}
partial class RawPrint {
 static void Expect(bool condition,string message) { if(!condition) throw new Exception(message); }
 public static void TestPaperModes() {
  double width,height;
  RequestedDimensions(new PreferenceInput { paper="A5",rollWidthMm=Double.NaN,rollHeightMm=-1 },out width,out height);
  Expect(width==148 && height==210,"Roll settings affected A5.");
  RequestedDimensions(new PreferenceInput { paper="thermal-58",rollWidthMm=220,rollHeightMm=130 },out width,out height);
  Expect(width==58 && height==130,"Custom width affected standard roll.");
  var a4=new PaperSize("A4",827,1169); a4.RawKind=9;
  var a5=new PaperSize("Driver A5",583,827); a5.RawKind=301;
  var papers=new [] { a4,a5 };
  Expect(SelectPaper(papers,148,210)==a5,"Driver-specific A5 form not selected.");
  Expect(SelectPaper(papers,80,130)==null,"Unsupported size incorrectly matched.");
  IntPtr mode=Marshal.AllocHGlobal(220);
  try {
   Marshal.Copy(new byte[220],0,mode,220);
   Marshal.WriteInt32(mode,Fields,0x10000|1|2|4|8|0x200);
   Marshal.WriteInt16(mode,Width,2100); Marshal.WriteInt16(mode,Length,2970);
   Marshal.WriteInt16(mode,102,'A');
   var input=new PreferenceInput { paper="A5",orientation="landscape" };
   ConfigureMode(mode,input,a5,148,210);
   Expect(Marshal.ReadInt16(mode,Paper)==301,"Native paper code lost.");
   Expect(Marshal.ReadInt16(mode,Width)==0 && Marshal.ReadInt16(mode,Length)==0,"Conflicting custom dimensions retained.");
   Expect((Marshal.ReadInt32(mode,Fields)&(4|8|0x10000))==0,"Conflicting form flags retained.");
   Expect((Marshal.ReadInt32(mode,Fields)&0x200)!=0,"Unrelated driver settings lost.");
   Expect(Marshal.ReadInt16(mode,102)==0,"Old form name retained.");
   var actual=DescribeMode(mode,papers,a4);
   ValidateAccepted(actual,input,148,210);
   Expect(actual.paperName==a5.PaperName,"Default A4 used instead of accepted A5.");

   Marshal.WriteInt32(mode,Fields,1|2|4|8);
   Marshal.WriteInt16(mode,Width,2100); Marshal.WriteInt16(mode,Length,1480);
   actual=DescribeMode(mode,papers,a4);
   ValidateAccepted(actual,input,148,210);
   Expect(actual.widthMm<149 && actual.heightMm>209,"Landscape form was not normalized.");

   Marshal.WriteInt16(mode,Width,2100); Marshal.WriteInt16(mode,Length,2970);
   bool rejected=false;
   try { ValidateAccepted(DescribeMode(mode,papers,a4),input,148,210); } catch(Exception error) { rejected=error.Message.Contains("driver returned"); }
   Expect(rejected,"Actual paper substitution was accepted.");
   ConfigureMode(mode,input,a5,148,210);
   Marshal.WriteInt16(mode,Orientation,1);
   rejected=false;
   try { ValidateAccepted(DescribeMode(mode,papers,a4),input,148,210); } catch { rejected=true; }
   Expect(rejected,"Actual orientation substitution was accepted.");

   input=new PreferenceInput { paper="custom-roll",orientation="portrait" };
   ConfigureMode(mode,input,null,80,130);
   Expect(Marshal.ReadInt16(mode,Paper)==0,"Custom roll used a named paper code.");
   Expect((Marshal.ReadInt32(mode,Fields)&2)==0,"Custom roll still requests a named paper.");
   Expect((Marshal.ReadInt32(mode,Fields)&(4|8))==(4|8),"Custom roll dimensions not marked as active.");
   ValidateAccepted(DescribeMode(mode,papers,a4),input,80,130);
   foreach(string roll in new [] { "thermal-58","thermal-80","custom-roll" }) {
    foreach(string orientation in new [] { "portrait","landscape" }) {
     input=new PreferenceInput { paper=roll,orientation=orientation,rollWidthMm=76,rollHeightMm=200 };
     RequestedDimensions(input,out width,out height);
     ConfigureMode(mode,input,null,width,height);
     Expect((Marshal.ReadInt32(mode,Fields)&(2|4|8))==(4|8),"Roll fields conflict: "+roll);
     ValidateAccepted(DescribeMode(mode,papers,a4),input,width,height);
    }
   }
   input=new PreferenceInput { paper="A5",orientation="landscape",rollWidthMm=80,rollHeightMm=130 };
   ConfigureMode(mode,input,a5,148,210);
   Expect((Marshal.ReadInt32(mode,Fields)&(4|8))==0,"Roll flags leaked into A5 after switching.");
   Expect(Marshal.ReadInt16(mode,Width)==0 && Marshal.ReadInt16(mode,Length)==0,"Roll dimensions leaked into A5 after switching.");
   ValidateAccepted(DescribeMode(mode,papers,a4),input,148,210);
   Console.WriteLine("PASS: native A5 form, conflicting fields, landscape dimensions, real substitutions, custom roll.");
  } finally { Marshal.FreeHGlobal(mode); }
 }
}
