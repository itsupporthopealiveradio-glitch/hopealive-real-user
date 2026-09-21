import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { Printer, X, ArrowLeft, Download } from "lucide-react";
import html2pdf from "html2pdf.js";

export default function TimesheetPrintView() {
  const { employeeId } = useParams();
  const [searchParams] = useSearchParams();
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  const navigate = useNavigate();
  const [data, setData] = useState<any[]>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w < 820) {
        setScale(Math.max(0.35, (w - 24) / 794));
      } else {
        setScale(1);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!employeeId || !startDate || !endDate) return;

      try {
        let employees = [];
        if (employeeId === "all") {
          const { data: allEmps, error: allEmpErr } = await supabase
            .from("employees")
            .select("id, first_name, last_name, full_name, signature_data");
          if (allEmpErr) throw allEmpErr;
          employees = allEmps || [];
        } else {
          const { data: emp, error: empErr } = await supabase
            .from("employees")
            .select("id, first_name, last_name, full_name, signature_data")
            .eq("id", employeeId)
            .single();
          if (empErr) throw empErr;
          employees = [emp];
        }

        const allData = [];

        for (const emp of employees) {
          const { data: records, error: recErr } = await supabase
            .from("attendance_records")
            .select("*")
            .eq("employee_id", emp.id)
            .gte("clock_in_at", startDate + "T00:00:00.000Z")
            .lte("clock_in_at", endDate + "T23:59:59.999Z")
            .order("clock_in_at", { ascending: true });

          if (recErr) throw recErr;

          const recordsByDate: Record<string, any> = {};
          
          records?.forEach(rec => {
            const dateObj = new Date(rec.clock_in_at);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const dateKey = `${day}/${month}/${year}`;
            
            if (!recordsByDate[dateKey]) {
              recordsByDate[dateKey] = {
                inObj: new Date(rec.clock_in_at),
                timeIn: new Date(rec.clock_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                timeOut: rec.clock_out_at ? new Date(rec.clock_out_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''
              };
            } else {
              if (rec.clock_out_at) {
                const currentOut = recordsByDate[dateKey].outObj;
                const newOut = new Date(rec.clock_out_at);
                if (!currentOut || newOut > currentOut) {
                  recordsByDate[dateKey].outObj = newOut;
                  recordsByDate[dateKey].timeOut = newOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                }
              }
            }
          });

          // Generate all weekdays between start and end date
          const generatedDates = [];
          let curr = new Date(startDate);
          const endObj = new Date(endDate);
          
          while (curr <= endObj && generatedDates.length < 31) {
            if (curr.getDay() !== 0 && curr.getDay() !== 6) { // skip sunday(0) and saturday(6)
              const day = String(curr.getDate()).padStart(2, '0');
              const month = String(curr.getMonth() + 1).padStart(2, '0');
              const year = curr.getFullYear();
              const dateKey = `${day}/${month}/${year}`;
              
              const existingRecord = recordsByDate[dateKey];
              generatedDates.push({
                date: dateKey,
                timeIn: existingRecord?.timeIn || '',
                timeOut: existingRecord?.timeOut || '',
                hasRecord: !!existingRecord
              });
            }
            curr.setDate(curr.getDate() + 1);
          }

          allData.push({ employee: emp, records: generatedDates, firstDate: generatedDates[0]?.date || '' });
        }

        setData(allData);
        setLoading(false);

      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    }

    fetchData();
  }, [employeeId, startDate, endDate]);

  if (loading) return <div className="p-10 font-sans text-white text-center">Generating Document...</div>;
  if (!data || data.length === 0) return <div className="p-10 font-sans text-red-500 text-center">Failed to load data.</div>;

  const handleBack = () => {
    // Navigate back if possible, otherwise go to root (works for both user app and admin)
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="bg-[#0f0f0f] min-h-screen text-black font-sans w-full flex flex-col items-center py-4 md:py-10 print:bg-white print:py-0 print:m-0 overflow-x-hidden">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-container { width: 794px !important; height: 1122px !important; max-height: 1122px !important; box-shadow: none !important; border: none !important; margin: 0 !important; border-radius: 0 !important; transform: none !important; page-break-after: always; overflow: hidden !important; }
          .print-container:last-child { page-break-after: auto; }
        }
      `}</style>

      {/* Action buttons (hidden when printing) */}
      <div className="no-print w-full max-w-[794px] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1a1a1a] p-4 sm:p-5 mb-4 sm:mb-8 rounded-2xl shadow-xl border border-white/10 gap-4 sm:gap-0 mx-4">
        <div>
          <h2 className="text-white font-bold text-xl">Timesheet Ready</h2>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Previewing exact physical template layout.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button onClick={handleBack} className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
            <ArrowLeft size={16} />
            Back
          </button>
          <button 
            onClick={async () => {
              const element = document.getElementById('print-root');
              if (!element) return;

              // Temporarily reset scale and remove gaps for 100% PDF capture
              const currentScale = scale;
              setScale(1);
              setIsGeneratingPdf(true);

              await new Promise(r => setTimeout(r, 100));

              const opt = {
                margin:       0,
                filename:     `Timesheet_${data[0]?.employee?.full_name?.replace(/\s+/g, '_') || 'Employee'}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
                jsPDF:        { unit: 'px', format: [794, 1123], orientation: 'portrait' },
                pagebreak:    { mode: ['css', 'legacy'] }
              };

              await html2pdf().set(opt).from(element).save();

              // Restore mobile scale and gaps
              setScale(currentScale);
              setIsGeneratingPdf(false);
            }} 
            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
            <Download size={18} />
            Download PDF
          </button>
          <button onClick={() => window.print()} className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#FBB03B] hover:bg-[#e5a035] text-black font-extrabold rounded-xl text-xs sm:text-sm shadow-lg shadow-[#FBB03B]/20 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
            <Printer size={18} />
            Print
          </button>
        </div>
      </div>

      <div 
        id="print-root" 
        className={`w-full max-w-[794px] flex flex-col items-center print:gap-0 print:pb-0 ${isGeneratingPdf ? 'gap-0 pb-0' : 'gap-8 pb-10'}`}
        style={{
          transform: scale < 1 ? `scale(${scale})` : 'none',
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${(1 - scale) * 1123}px` : '0px'
        }}
      >
        {data.map((pageData, pageIndex) => {
          const { employee, records, firstDate } = pageData;
          const rows = Array.from({ length: 31 }).map((_, i) => records[i] || null);
          const empName = employee.first_name || employee.full_name?.split(' ')[0] || '';
          const empSurname = employee.last_name || employee.full_name?.split(' ').slice(1).join(' ') || '';

          return (
            <div key={pageIndex} className="print-container bg-white w-[794px] h-[1123px] max-h-[1123px] shadow-2xl relative flex flex-col pt-[57px] pb-0 box-border print:min-w-0 mx-auto overflow-hidden">
              
              {/* Logos at top */}
              <div className="absolute top-[30px] left-[57px] h-[83px] z-20 flex items-center">
                <img src="/tbg-logo.png" alt="TBG Logo" className="h-full w-auto object-contain" />
              </div>
              <div className="absolute top-[30px] right-[57px] h-[75px] z-20 flex items-center">
                <img src="/logo.png" alt="Hope Alive Radio" className="h-full w-auto object-contain brightness-0" />
              </div>

              {/* Header */}
              <div className="flex justify-between items-start mb-2 px-[57px] pt-[98px] relative z-10">
                <div className="flex-1 mt-2">
                  <h1 className="text-[18px] font-bold font-serif text-black leading-tight tracking-tight">Time and Attendance Spreadsheet</h1>
                  <h2 className="text-[#FBB03B] italic font-bold font-serif text-[15px] leading-tight mb-2">Shaping Minds for a Better Future</h2>
                  
                  <div className="font-serif text-[14px] font-bold mt-1 space-y-2 text-black">
                    <div className="flex items-end">
                      <span className="whitespace-nowrap pb-0.5">Name and Surname |&nbsp;</span>
                      <div className="relative inline-block border-b-[1.5px] border-dotted border-black w-[350px]">
                        <span className="absolute bottom-0 left-2 font-normal text-black text-[14px]">{empName} {empSurname}</span>
                      </div>
                    </div>
                    <div className="flex items-end pt-1">
                      <span className="whitespace-nowrap pb-0.5">Month |&nbsp;</span>
                      <div className="relative inline-block border-b-[1.5px] border-dotted border-black w-[350px]">
                        <span className="absolute bottom-0 left-2 font-normal text-black text-[14px]">{firstDate}</span>
                      </div>
                    </div>
                    <div className="flex items-end pt-1">
                      <span className="whitespace-nowrap pb-0.5 font-bold text-sm">Learner signature |&nbsp;</span>
                      <div className="relative inline-block border-b-[1.5px] border-dotted border-black w-[200px] h-[26px]">
                        {employee.signature_data && (
                          <img src={employee.signature_data} alt="signature" className="absolute bottom-0 left-0 h-full w-full object-contain opacity-90 mix-blend-multiply" />
                        )}
                      </div>
                      <span className="whitespace-nowrap ml-2 pb-0.5 font-bold">Signature Manager&nbsp;</span>
                      <div className="relative inline-block border-b-[1.5px] border-dotted border-black w-[200px]">
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="w-full border-[1.5px] border-black flex flex-col font-serif mt-2 z-20 bg-white mx-auto relative" style={{ width: 'calc(100% - 114px)' }}>
                <div className="flex border-b-[1.5px] border-black font-bold text-[13px] text-center bg-white h-[28px] items-center">
                  <div className="w-[120px] border-r-[1.5px] border-black h-full flex items-center justify-center text-black">DATE</div>
                  <div className="flex-1 border-r-[1.5px] border-black h-full flex items-center justify-center text-black">TIME IN</div>
                  <div className="flex-1 border-r-[1.5px] border-black h-full flex items-center justify-center text-black">TIME OUT</div>
                  <div className="w-[150px] h-full flex items-center justify-center text-black">SIGNATURE</div>
                </div>

                {rows.map((row, index) => (
                  <div key={index} className={`flex text-[13px] ${index !== 30 ? 'border-b border-black' : ''} h-[18px] relative`}>
                    <div className="w-[120px] border-r border-black flex items-center px-2 font-normal text-black z-20">
                      <span className="mr-2 w-4 text-right text-black">{index + 1}.</span> <span className="text-black">{row?.date || ''}</span>
                    </div>
                    <div className="flex-1 border-r border-black flex items-center justify-center font-normal text-black z-20">
                      <span className="text-black">{row?.timeIn || ''}</span>
                    </div>
                    <div className="flex-1 border-r border-black flex items-center justify-center font-normal text-black z-20">
                      <span className="text-black">{row?.timeOut || ''}</span>
                    </div>
                    <div className="w-[150px] flex items-center justify-center relative z-20 px-1 py-0.5">
                      {row?.hasRecord && employee.signature_data ? (
                        <img src={employee.signature_data} alt="signature" className="h-full w-full object-contain opacity-85 mix-blend-multiply pointer-events-none" />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Image Cropped perfectly from template */}
              <div className="absolute bottom-[19px] left-[57px] right-[57px] w-[680px] h-[189px] z-10 overflow-hidden">
                <img src="/footer-graphic.png" className="absolute bottom-0 max-w-none" style={{ width: '718px', left: '-19px' }} alt="footer graphic" />
                {/* White mask over the left side to erase the baked-in background table lines */}
                <div className="absolute top-0 left-0 w-[529px] h-[53px] bg-white"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
