/*
  Right Tick Recruitment — Educator Onboarding & Compliance Portal
  ================================================================
  Architecture: Single-page React app (production-ready scaffold)
  - All state managed in React (swap for Supabase/Firebase in production)
  - Role-based views: Educator wizard + Admin dashboard
  - Full contract with scroll-gate + per-clause checkboxes
  - Document upload simulation with status tracking
  - Expiry tracking with badge logic
  - Sample data for 4 educators

  Database schema (Supabase/Firebase):
    users, educators, contract_acceptances, qualifications,
    compliance_documents, audit_logs  — see comments below each section

  To deploy:
    1. Replace sample data with real Supabase/Firebase reads
    2. Wire file upload inputs to cloud storage (S3, GCS, Supabase Storage)
    3. Add real auth (Supabase Auth / Firebase Auth)
    4. Configure email via SendGrid / Resend using email templates
    5. Set up cron job for expiry reminders (60/30/7 day intervals)
*/

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Fonts & Global Styles ─────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#f0f4f8;color:#1a2744;min-height:100vh}
  :root{
    --navy:#1a2744;--navy-light:#243459;--navy-dark:#0f1a2e;
    --teal:#0f7b6c;--teal-light:#e6f5f2;--teal-border:#b2ddd8;
    --green:#1a8a4a;--green-bg:#e6f5ec;--green-border:#a3d9b5;
    --amber:#c47a0a;--amber-bg:#fff8e6;--amber-border:#f0d080;
    --red:#c0392b;--red-bg:#fdf0ee;--red-border:#f0b8b3;
    --blue:#1862c4;--blue-bg:#eaf1fd;--blue-border:#adc8f0;
    --gray:#6b7a99;--gray-light:#f7f9fc;--gray-border:#dde3ee;
    --white:#ffffff;--card-radius:14px;--input-radius:8px;
    --shadow:0 2px 12px rgba(26,39,68,0.08);
    --shadow-lg:0 8px 32px rgba(26,39,68,0.13);
  }
  input,select,textarea{font-family:inherit}
  button{cursor:pointer;font-family:inherit}
  a{color:var(--teal);text-decoration:none}
`;

// ─── Sample Data ───────────────────────────────────────────────────────────
const SAMPLE_EDUCATORS = [
  {
    educatorId: "edu-001",
    firstName: "Amelia", lastName: "Chen", email: "amelia.chen@email.com",
    mobile: "0412 345 678", qualificationStatus: "Certificate III Complete",
    overallStatus: "Approved", submittedAt: "2024-11-15",
    wwvpExpiry: "2026-03-20", firstAidExpiry: "2025-08-10",
    geckoDate: "2024-09-01", visaExpiry: null,
    docs: {
      qualification:{status:"Approved"}, wwvp:{status:"Approved"},
      first_aid:{status:"Expiring Soon"}, geccko_child_safety:{status:"Approved"},
      photo_id:{status:"Approved"}
    }
  },
  {
    educatorId: "edu-002",
    firstName: "Marcus", lastName: "Okafor", email: "marcus.okafor@email.com",
    mobile: "0423 456 789", qualificationStatus: "Working towards Diploma",
    overallStatus: "Submitted for Review", submittedAt: "2025-01-08",
    wwvpExpiry: "2027-06-14", firstAidExpiry: "2026-04-22",
    geckoDate: "2024-12-10", visaExpiry: null,
    docs: {
      qualification:{status:"Uploaded"}, wwvp:{status:"Approved"},
      first_aid:{status:"Uploaded"}, geccko_child_safety:{status:"Uploaded"},
      photo_id:{status:"Missing"}
    }
  },
  {
    educatorId: "edu-003",
    firstName: "Priya", lastName: "Sharma", email: "priya.sharma@email.com",
    mobile: "0434 567 890", qualificationStatus: "Diploma Complete",
    overallStatus: "Needs Correction", submittedAt: "2024-12-20",
    wwvpExpiry: "2025-09-30", firstAidExpiry: "2025-12-15",
    geckoDate: "2024-06-01", visaExpiry: "2026-08-31",
    docs: {
      qualification:{status:"Approved"}, wwvp:{status:"Rejected",note:"Card image unclear, please re-upload"},
      first_aid:{status:"Approved"}, geccko_child_safety:{status:"Approved"},
      visa_work_rights:{status:"Approved"}, photo_id:{status:"Approved"}
    }
  },
  {
    educatorId: "edu-004",
    firstName: "Tom", lastName: "Nguyen", email: "tom.nguyen@email.com",
    mobile: "0445 678 901", qualificationStatus: "Working towards Certificate III",
    overallStatus: "Incomplete", submittedAt: null,
    wwvpExpiry: null, firstAidExpiry: null,
    geckoDate: null, visaExpiry: null,
    docs: {
      qualification:{status:"Missing"}, wwvp:{status:"Missing"},
      first_aid:{status:"Missing"}, geccko_child_safety:{status:"Missing"},
      photo_id:{status:"Missing"}
    }
  }
];

// ─── Status Badge ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  "Approved":           {bg:"var(--green-bg)",  color:"var(--green)",  border:"var(--green-border)"},
  "Submitted for Review":{bg:"var(--blue-bg)", color:"var(--blue)",   border:"var(--blue-border)"},
  "Needs Correction":   {bg:"var(--amber-bg)", color:"var(--amber)",  border:"var(--amber-border)"},
  "Incomplete":         {bg:"var(--gray-light)",color:"var(--gray)",  border:"var(--gray-border)"},
  "Expired Document":   {bg:"var(--red-bg)",   color:"var(--red)",    border:"var(--red-border)"},
  "Expiring Soon":      {bg:"var(--amber-bg)", color:"var(--amber)",  border:"var(--amber-border)"},
  "Inactive":           {bg:"var(--gray-light)",color:"var(--gray)",  border:"var(--gray-border)"},
  "Uploaded":           {bg:"var(--blue-bg)",  color:"var(--blue)",   border:"var(--blue-border)"},
  "Missing":            {bg:"var(--red-bg)",   color:"var(--red)",    border:"var(--red-border)"},
  "Rejected":           {bg:"var(--red-bg)",   color:"var(--red)",    border:"var(--red-border)"},
  "Expired":            {bg:"var(--red-bg)",   color:"var(--red)",    border:"var(--red-border)"},
};

function Badge({status, size="sm"}) {
  const s = STATUS_COLORS[status] || STATUS_COLORS["Missing"];
  const pad = size === "sm" ? "3px 10px" : "5px 14px";
  const fs = size === "sm" ? "12px" : "13px";
  return (
    <span style={{
      background:s.bg, color:s.color, border:`1px solid ${s.border}`,
      borderRadius:"20px", padding:pad, fontSize:fs, fontWeight:600,
      display:"inline-block", whiteSpace:"nowrap"
    }}>{status}</span>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────
function Header({view, onSwitch, educatorName}) {
  return (
    <header style={{
      background:"var(--navy)", color:"#fff", padding:"0 32px",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      height:"64px", position:"sticky", top:0, zIndex:100,
      boxShadow:"0 2px 12px rgba(0,0,0,0.18)"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{
          width:36, height:36, borderRadius:8,
          background:"linear-gradient(135deg,#0f7b6c,#1a8a4a)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:20, fontWeight:700, color:"#fff"
        }}>✓</div>
        <div>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,letterSpacing:0.2}}>Right Tick Recruitment</div>
          <div style={{fontSize:11,color:"#aab8d4",letterSpacing:0.8,textTransform:"uppercase"}}>Educator Onboarding & Compliance Portal</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {educatorName && <span style={{fontSize:13,color:"#aab8d4"}}>Hi, {educatorName}</span>}
        <button onClick={()=>onSwitch(view==="educator"?"admin":"educator")} style={{
          background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)",
          borderRadius:8, color:"#fff", padding:"7px 16px", fontSize:13,
          fontWeight:500, transition:"background 0.2s"
        }}>
          {view==="educator" ? "Admin View →" : "← Educator View"}
        </button>
      </div>
    </header>
  );
}

// ─── Progress Steps ────────────────────────────────────────────────────────
const STEPS = ["Personal Info","Emergency Contact","Contract","Qualifications","Documents","Review & Submit"];

function ProgressBar({current}) {
  return (
    <div style={{
      background:"#fff", borderBottom:"1px solid var(--gray-border)",
      padding:"18px 32px", display:"flex", alignItems:"center",
      gap:0, overflowX:"auto"
    }}>
      {STEPS.map((s,i) => (
        <div key={i} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{
              width:30, height:30, borderRadius:"50%",
              background: i<current ? "var(--green)" : i===current ? "var(--navy)" : "var(--gray-border)",
              color: i<=current ? "#fff" : "var(--gray)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:13, fontWeight:600, flexShrink:0, transition:"all 0.3s"
            }}>
              {i<current ? "✓" : i+1}
            </div>
            <span style={{
              fontSize:13, fontWeight: i===current ? 600 : 400,
              color: i===current ? "var(--navy)" : i<current ? "var(--green)" : "var(--gray)",
              whiteSpace:"nowrap"
            }}>{s}</span>
          </div>
          {i<STEPS.length-1 && (
            <div style={{flex:1,height:2,background:i<current?"var(--green)":"var(--gray-border)",margin:"0 10px",minWidth:20,transition:"background 0.3s"}}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Form Field Helpers ────────────────────────────────────────────────────
function Field({label, required, children, note}) {
  return (
    <div style={{marginBottom:20}}>
      <label style={{display:"block",fontSize:13,fontWeight:600,color:"var(--navy)",marginBottom:6}}>
        {label}{required && <span style={{color:"var(--red)",marginLeft:3}}>*</span>}
      </label>
      {children}
      {note && <p style={{fontSize:12,color:"var(--gray)",marginTop:4}}>{note}</p>}
    </div>
  );
}

function Input({...props}) {
  return <input {...props} style={{
    width:"100%", padding:"10px 14px", borderRadius:8,
    border:"1.5px solid var(--gray-border)", fontSize:14, outline:"none",
    transition:"border 0.2s", background:"#fff", color:"var(--navy)",
    ...props.style
  }} onFocus={e=>e.target.style.borderColor="var(--teal)"}
     onBlur={e=>e.target.style.borderColor="var(--gray-border)"}/>;
}

function Select({children, ...props}) {
  return <select {...props} style={{
    width:"100%", padding:"10px 14px", borderRadius:8,
    border:"1.5px solid var(--gray-border)", fontSize:14, outline:"none",
    background:"#fff", color:"var(--navy)", appearance:"none",
    backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%236b7a99' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
    backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center",
    paddingRight:36
  }}>{children}</select>;
}

function Card({children, style}) {
  return <div style={{background:"#fff", borderRadius:"var(--card-radius)", border:"1px solid var(--gray-border)", padding:"28px 32px", boxShadow:"var(--shadow)", ...style}}>{children}</div>;
}

function SectionTitle({children}) {
  return <h3 style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:"var(--navy)",marginBottom:6}}>{children}</h3>;
}

function NavButtons({onBack, onNext, nextLabel="Save & Continue", canNext=true}) {
  return (
    <div style={{display:"flex",gap:12,marginTop:32,paddingTop:20,borderTop:"1px solid var(--gray-border)"}}>
      {onBack && (
        <button onClick={onBack} style={{
          padding:"11px 28px", borderRadius:8, border:"1.5px solid var(--gray-border)",
          background:"#fff", color:"var(--navy)", fontSize:14, fontWeight:600
        }}>← Back</button>
      )}
      <button onClick={onNext} disabled={!canNext} style={{
        padding:"11px 28px", borderRadius:8, border:"none",
        background: canNext ? "var(--navy)" : "var(--gray-border)",
        color: canNext ? "#fff" : "var(--gray)", fontSize:14, fontWeight:600,
        marginLeft:"auto", transition:"background 0.2s",
        opacity: canNext ? 1 : 0.7
      }}>{nextLabel}</button>
    </div>
  );
}

// ─── Step 1: Personal Information ──────────────────────────────────────────
function StepPersonal({data, onChange, onNext}) {
  return (
    <Card>
      <SectionTitle>Personal Information</SectionTitle>
      <p style={{color:"var(--gray)",fontSize:14,marginBottom:24}}>Please enter your legal name and contact details exactly as they appear on your ID.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        <Field label="First Name" required>
          <Input value={data.firstName||""} onChange={e=>onChange("firstName",e.target.value)} placeholder="First name"/>
        </Field>
        <Field label="Middle Name">
          <Input value={data.middleName||""} onChange={e=>onChange("middleName",e.target.value)} placeholder="Middle name (if applicable)"/>
        </Field>
        <Field label="Last Name" required>
          <Input value={data.lastName||""} onChange={e=>onChange("lastName",e.target.value)} placeholder="Last name"/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Field label="Date of Birth" required>
          <Input type="date" value={data.dateOfBirth||""} onChange={e=>onChange("dateOfBirth",e.target.value)}/>
        </Field>
        <Field label="Residency Status" required>
          <Select value={data.residencyStatus||""} onChange={e=>onChange("residencyStatus",e.target.value)}>
            <option value="">Select status…</option>
            <option>Australian Citizen</option>
            <option>Permanent Resident</option>
            <option>Temporary Visa Holder</option>
            <option>Working Holiday Visa</option>
            <option>Student Visa</option>
          </Select>
        </Field>
      </div>
      <Field label="Residential Address" required>
        <Input value={data.address||""} onChange={e=>onChange("address",e.target.value)} placeholder="Street address"/>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        <Field label="Suburb" required>
          <Input value={data.suburb||""} onChange={e=>onChange("suburb",e.target.value)} placeholder="Suburb"/>
        </Field>
        <Field label="State" required>
          <Select value={data.state||""} onChange={e=>onChange("state",e.target.value)}>
            <option value="">State…</option>
            {["ACT","NSW","VIC","QLD","SA","WA","TAS","NT"].map(s=><option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Postcode" required>
          <Input value={data.postcode||""} onChange={e=>onChange("postcode",e.target.value)} placeholder="0000"/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Field label="Mobile Number" required>
          <Input value={data.mobile||""} onChange={e=>onChange("mobile",e.target.value)} placeholder="04XX XXX XXX"/>
        </Field>
        <Field label="Email Address" required>
          <Input type="email" value={data.email||""} onChange={e=>onChange("email",e.target.value)} placeholder="your@email.com"/>
        </Field>
      </div>
      <Field label="Do you have a medical condition or injury that may affect your ability to carry out childcare duties?" required>
        <Select value={data.medicalConditionDeclared||""} onChange={e=>onChange("medicalConditionDeclared",e.target.value)}>
          <option value="">Select…</option>
          <option value="no">No</option>
          <option value="yes">Yes — I will provide a Personal Health Statement</option>
        </Select>
      </Field>
      <NavButtons onNext={onNext} canNext={!!(data.firstName&&data.lastName&&data.email&&data.mobile&&data.residencyStatus)}/>
    </Card>
  );
}

// ─── Step 2: Emergency Contact ─────────────────────────────────────────────
function StepEmergency({data, onChange, onBack, onNext}) {
  return (
    <Card>
      <SectionTitle>Emergency Contact</SectionTitle>
      <p style={{color:"var(--gray)",fontSize:14,marginBottom:24}}>Please provide details for someone we can contact in an emergency. This person should not be a fellow educator.</p>
      <Field label="Emergency Contact Full Name" required>
        <Input value={data.emergencyName||""} onChange={e=>onChange("emergencyName",e.target.value)} placeholder="Full name"/>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Field label="Mobile Number" required>
          <Input value={data.emergencyMobile||""} onChange={e=>onChange("emergencyMobile",e.target.value)} placeholder="04XX XXX XXX"/>
        </Field>
        <Field label="Relationship to You" required>
          <Select value={data.emergencyRelationship||""} onChange={e=>onChange("emergencyRelationship",e.target.value)}>
            <option value="">Select…</option>
            {["Partner/Spouse","Parent","Sibling","Friend","Other Family Member","Other"].map(r=><option key={r}>{r}</option>)}
          </Select>
        </Field>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} canNext={!!(data.emergencyName&&data.emergencyMobile&&data.emergencyRelationship)}/>
    </Card>
  );
}

// ─── Step 3: Employment Contract ───────────────────────────────────────────
const CONTRACT_CLAUSES = [
  "I am a casual employee of Right Tick Recruitment.",
  "I have provided accurate personal details to Right Tick Recruitment.",
  "I cannot approach directors or managers of client childcare centres for employment while employed by Right Tick Recruitment.",
  "I cannot include client childcare centres on my resume as my employer because Right Tick Recruitment is my employer.",
  "I cannot include client childcare directors as my referee unless authorised.",
  "Right Tick Recruitment is my first point of contact for work-related issues.",
  "I cannot apply for any role with clients of Right Tick Recruitment while working as a casual educator with Right Tick Recruitment.",
  "I understand there is a policy preventing clients of Right Tick Recruitment from recruiting educators supplied by Right Tick Recruitment for six months after the educator resigns from Right Tick Recruitment.",
  "I am medically fit to carry out the duties of a childcare educator.",
  "I have attached proof of qualification, enrolment, or approved study evidence.",
  "I give permission to Right Tick Recruitment to share my relevant details and compliance documents with client childcare centres where required for legal, regulatory, operational, or compliance purposes.",
  "I have read and accepted the terms and conditions of employment with Right Tick Recruitment.",
];

function ContractSection({title, children}) {
  return (
    <div style={{marginBottom:22}}>
      <h4 style={{fontSize:14,fontWeight:700,color:"var(--navy)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.6}}>{title}</h4>
      <div style={{fontSize:13.5,color:"#2c3a5a",lineHeight:1.7}}>{children}</div>
    </div>
  );
}

function StepContract({data, onChange, onBack, onNext}) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const clauses = data.clauses || {};
  const allChecked = CONTRACT_CLAUSES.every((_,i)=>clauses[i]);
  const canProceed = scrolled && allChecked && data.fullName && data.acceptDate && data.iAgree;

  function handleScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) setScrolled(true);
  }

  return (
    <Card>
      <SectionTitle>Casual Employment Contract</SectionTitle>
      <p style={{color:"var(--gray)",fontSize:14,marginBottom:18}}>Please read the full contract carefully. You must scroll to the bottom before you can accept.</p>

      {/* Scroll container */}
      <div ref={scrollRef} onScroll={handleScroll} style={{
        height:420, overflowY:"scroll", border:"1.5px solid var(--gray-border)",
        borderRadius:10, padding:"24px 28px", background:"var(--gray-light)",
        fontSize:13.5, lineHeight:1.8, color:"#2c3a5a", marginBottom:20
      }}>
        <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,textAlign:"center",marginBottom:6,color:"var(--navy)"}}>Casual Employment Contract</div>
        <div style={{textAlign:"center",fontSize:14,fontWeight:600,marginBottom:4}}>Casual Childcare Educator</div>
        <div style={{textAlign:"center",fontSize:13,color:"var(--gray)",marginBottom:24}}>Right Tick Recruitment</div>

        <ContractSection title="Introduction">
          This agreement creates a Casual Employment Contract between Right Tick Recruitment and the educator. The educator is engaged as a Casual Childcare Educator.
        </ContractSection>

        <ContractSection title="Position">
          Casual Childcare Educator
        </ContractSection>

        <ContractSection title="Six Month Exclusion Rule">
          <p style={{marginBottom:8}}>An educator cannot apply for a role, whether permanent full-time, permanent part-time, or casual, with clients of Right Tick Recruitment while under contract with Right Tick Recruitment.</p>
          <p style={{marginBottom:8}}>An educator cannot apply for a role, whether permanent part-time or casual, with clients of Right Tick Recruitment for six months after their resignation from Right Tick Recruitment.</p>
          <p>This same rule applies to clients of Right Tick Recruitment, who cannot hire educators supplied by Right Tick Recruitment while the educator is under contract with Right Tick Recruitment or for six months after the educator has resigned from Right Tick Recruitment.</p>
        </ContractSection>

        <ContractSection title="Main Duties">
          <p style={{marginBottom:6}}>The main duties of a Casual Childcare Educator include, but are not limited to:</p>
          <ul style={{paddingLeft:20}}>
            {[
              "Understand and apply the National Quality Standard for early childhood education and care and outside school hours care services in Australia.",
              "Understand and apply mandatory reporting obligations relating to child abuse and neglect.",
              "Assist in the preparation, implementation and evaluation of developmentally appropriate programs for individual children or groups.",
              "Record observations of individual children or groups for program planning purposes for qualified staff.",
              "Under direction, work with individual children with particular needs.",
              "Assist in the direction of untrained staff.",
              "Undertake and implement the requirements of quality assurance.",
              "Work in accordance with food safety regulations.",
              "Follow lawful and reasonable directions from Right Tick Recruitment and client childcare centres.",
              "Maintain professional conduct while working at client centres.",
            ].map((d,i)=><li key={i} style={{marginBottom:4}}>{d}</li>)}
          </ul>
        </ContractSection>

        <ContractSection title="Mandatory Reporting">
          The educator acknowledges that they must understand and comply with mandatory reporting obligations for child abuse and neglect in the Australian Capital Territory.
        </ContractSection>

        <ContractSection title="Eliminating Restrictive Practice">
          The educator acknowledges that they must familiarise themselves with legislative requirements relating to eliminating restrictive practices with children.
        </ContractSection>

        <ContractSection title="Fair Work Acknowledgement">
          The educator acknowledges that they have received and read the Fair Work Information Statement and the Casual Employment Information Statement.
        </ContractSection>

        <ContractSection title="Important Employment Information">
          <ul style={{paddingLeft:20}}>
            {[
              "This agreement does not waive the educator's rights and conditions under the Fair Work Act.",
              "The educator should review the Fair Work Information Statement to understand their rights and obligations.",
              "The educator will be paid for each occasion worked to the exact hour or the next highest five minutes.",
              "The minimum period of engagement for casual professional staff is three hours.",
              "Any additional duties required during the term of employment will be paid at the rate applicable to the duty required.",
              "A minimum half-hour unpaid meal break must be taken after five hours of continuous work unless directed otherwise.",
              "One working day's notice is required to terminate employment.",
              "Resignation must be submitted in writing via email or post. SMS is not an acceptable form of communication for resignation.",
            ].map((d,i)=><li key={i} style={{marginBottom:4}}>{d}</li>)}
          </ul>
        </ContractSection>
      </div>

      {!scrolled && (
        <div style={{
          background:"var(--amber-bg)", border:"1px solid var(--amber-border)",
          borderRadius:8, padding:"10px 16px", fontSize:13, color:"var(--amber)",
          marginBottom:16, display:"flex", alignItems:"center", gap:8
        }}>
          ↑ Please scroll to the bottom of the contract to continue.
        </div>
      )}

      {/* Per-clause checkboxes */}
      <div style={{marginBottom:24}}>
        <h4 style={{fontSize:14,fontWeight:700,color:"var(--navy)",marginBottom:12,textTransform:"uppercase",letterSpacing:0.6}}>Terms & Conditions — Please tick each acknowledgement</h4>
        {CONTRACT_CLAUSES.map((clause,i)=>(
          <label key={i} style={{
            display:"flex", gap:12, alignItems:"flex-start", marginBottom:10,
            padding:"10px 14px", borderRadius:8,
            background: clauses[i] ? "var(--green-bg)" : "var(--gray-light)",
            border:`1px solid ${clauses[i] ? "var(--green-border)" : "var(--gray-border)"}`,
            cursor:"pointer", transition:"all 0.2s"
          }}>
            <input type="checkbox" checked={!!clauses[i]}
              disabled={!scrolled}
              onChange={e=>onChange("clauses",{...clauses,[i]:e.target.checked})}
              style={{marginTop:2,width:16,height:16,accentColor:"var(--green)",flexShrink:0}}/>
            <span style={{fontSize:13.5,color:"var(--navy)",lineHeight:1.6}}>{clause}</span>
          </label>
        ))}
      </div>

      {/* Final acceptance */}
      <div style={{background:"var(--navy)",borderRadius:10,padding:"24px 28px",color:"#fff",marginBottom:20}}>
        <p style={{fontWeight:600,fontSize:15,marginBottom:16}}>Final Acceptance</p>
        <p style={{fontSize:13.5,marginBottom:20,color:"#b8c7e0",lineHeight:1.6}}>
          I have read and accept the terms and conditions of employment with Right Tick Recruitment.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <div>
            <label style={{fontSize:12,color:"#8fa5c8",marginBottom:4,display:"block",fontWeight:600}}>Full Legal Name *</label>
            <input value={data.fullName||""} onChange={e=>onChange("fullName",e.target.value)}
              placeholder="Type your full name" disabled={!scrolled||!allChecked}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid rgba(255,255,255,0.2)",
                background:"rgba(255,255,255,0.08)",color:"#fff",fontSize:14,outline:"none",
                opacity:(!scrolled||!allChecked)?0.5:1}}/>
          </div>
          <div>
            <label style={{fontSize:12,color:"#8fa5c8",marginBottom:4,display:"block",fontWeight:600}}>Date *</label>
            <input type="date" value={data.acceptDate||""} onChange={e=>onChange("acceptDate",e.target.value)}
              disabled={!scrolled||!allChecked}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid rgba(255,255,255,0.2)",
                background:"rgba(255,255,255,0.08)",color:"#fff",fontSize:14,outline:"none",
                opacity:(!scrolled||!allChecked)?0.5:1,colorScheme:"dark"}}/>
          </div>
        </div>
        <div>
          <label style={{fontSize:12,color:"#8fa5c8",marginBottom:4,display:"block",fontWeight:600}}>Digital Signature — Type your full name as signature *</label>
          <input value={data.digitalSignature||""} onChange={e=>onChange("digitalSignature",e.target.value)}
            placeholder="Sign here by typing your full name" disabled={!scrolled||!allChecked}
            style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid rgba(255,255,255,0.2)",
              background:"rgba(255,255,255,0.08)",color:"#fff",fontSize:18,outline:"none",
              fontFamily:"'DM Serif Display',serif",fontStyle:"italic",
              opacity:(!scrolled||!allChecked)?0.5:1}}/>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:10,marginTop:16,cursor:"pointer"}}>
          <input type="checkbox" checked={!!data.iAgree} disabled={!scrolled||!allChecked}
            onChange={e=>onChange("iAgree",e.target.checked)}
            style={{width:18,height:18,accentColor:"#0f7b6c",flexShrink:0}}/>
          <span style={{fontSize:13.5,fontWeight:600}}>I agree</span>
        </label>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} canNext={canProceed}/>
    </Card>
  );
}

// ─── Step 4: Qualifications ────────────────────────────────────────────────
function StepQualifications({data, onChange, onBack, onNext}) {
  return (
    <Card>
      <SectionTitle>Qualification & Work Rights</SectionTitle>
      <p style={{color:"var(--gray)",fontSize:14,marginBottom:24}}>Please provide details of your childcare qualification or current enrolment.</p>

      <Field label="Qualification Status" required>
        <Select value={data.qualificationStatus||""} onChange={e=>onChange("qualificationStatus",e.target.value)}>
          <option value="">Select…</option>
          <option>Certificate III in Children Services — Completed</option>
          <option>Diploma in Children Services — Completed</option>
          <option>Working towards Certificate III</option>
          <option>Working towards Diploma</option>
          <option>ECT / Bachelor qualification</option>
        </Select>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Field label="Qualification Name" required>
          <Input value={data.qualificationName||""} onChange={e=>onChange("qualificationName",e.target.value)} placeholder="e.g. Certificate III in Early Childhood Education and Care"/>
        </Field>
        <Field label="Training Provider / College" required>
          <Input value={data.trainingProvider||""} onChange={e=>onChange("trainingProvider",e.target.value)} placeholder="Institution name"/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Field label="RTO Number (if applicable)">
          <Input value={data.rtoNumber||""} onChange={e=>onChange("rtoNumber",e.target.value)} placeholder="e.g. 12345"/>
        </Field>
        <Field label="Date Commenced" required>
          <Input type="date" value={data.dateCommenced||""} onChange={e=>onChange("dateCommenced",e.target.value)}/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Field label="Expected Completion Date">
          <Input type="date" value={data.expectedCompletionDate||""} onChange={e=>onChange("expectedCompletionDate",e.target.value)}/>
        </Field>
        <Field label="Completion Date (if completed)">
          <Input type="date" value={data.completionDate||""} onChange={e=>onChange("completionDate",e.target.value)}/>
        </Field>
      </div>

      {/* Visa section — conditional */}
      {data.residencyStatus && !["Australian Citizen","Permanent Resident"].includes(data.residencyStatus) && (
        <div style={{borderTop:"1px solid var(--gray-border)",paddingTop:20,marginTop:8}}>
          <h4 style={{fontSize:15,fontWeight:700,color:"var(--navy)",marginBottom:16}}>Visa / Work Rights Details</h4>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Field label="Visa Type" required>
              <Input value={data.visaType||""} onChange={e=>onChange("visaType",e.target.value)} placeholder="e.g. Student Visa (Subclass 500)"/>
            </Field>
            <Field label="Visa Expiry Date" required>
              <Input type="date" value={data.visaExpiryDate||""} onChange={e=>onChange("visaExpiryDate",e.target.value)}/>
            </Field>
          </div>
          <Field label="Work Restriction Details">
            <textarea value={data.workRestrictionDetails||""} onChange={e=>onChange("workRestrictionDetails",e.target.value)}
              placeholder="Describe any work hour limitations or conditions on your visa…"
              rows={3} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid var(--gray-border)",
                fontSize:14,outline:"none",resize:"vertical",fontFamily:"inherit",color:"var(--navy)"}}/>
          </Field>
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} canNext={!!(data.qualificationStatus&&data.qualificationName&&data.trainingProvider)}/>
    </Card>
  );
}

// ─── Step 5: Documents Upload ──────────────────────────────────────────────
function UploadField({label, hint, onUpload, status, fileName}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  function handle(file) {
    if (!file) return;
    onUpload && onUpload(file);
  }

  return (
    <div style={{marginBottom:8}}>
      {label && <label style={{fontSize:12,fontWeight:600,color:"var(--navy)",display:"block",marginBottom:4}}>{label}</label>}
      <div
        onDragOver={e=>{e.preventDefault();setDragging(true)}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handle(e.dataTransfer.files[0])}}
        onClick={()=>inputRef.current.click()}
        style={{
          border:`2px dashed ${dragging?"var(--teal)":"var(--gray-border)"}`,
          borderRadius:8, padding:"14px 16px", textAlign:"center",
          cursor:"pointer", background:dragging?"var(--teal-light)":"var(--gray-light)",
          transition:"all 0.2s"
        }}>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}}
          onChange={e=>handle(e.target.files[0])}/>
        {fileName ? (
          <div style={{fontSize:13,color:"var(--green)",fontWeight:600}}>✓ {fileName}</div>
        ) : (
          <div>
            <div style={{fontSize:22,marginBottom:4}}>⬆</div>
            <div style={{fontSize:12,color:"var(--gray)"}}>Click or drag to upload &bull; PDF, JPG, PNG</div>
            {hint && <div style={{fontSize:11,color:"var(--gray)",marginTop:2}}>{hint}</div>}
          </div>
        )}
      </div>
      {status && (
        <div style={{marginTop:4}}><Badge status={status}/></div>
      )}
    </div>
  );
}

function DocSection({title, color="var(--blue-bg)", border="var(--blue-border)", children}) {
  return (
    <div style={{border:`1.5px solid ${border}`,borderRadius:10,overflow:"hidden",marginBottom:20}}>
      <div style={{background:color,padding:"12px 20px",borderBottom:`1px solid ${border}`}}>
        <span style={{fontSize:14,fontWeight:700,color:"var(--navy)"}}>{title}</span>
      </div>
      <div style={{padding:"20px"}}>{children}</div>
    </div>
  );
}

function StepDocuments({personalData, qualData, docData, onChange, onBack, onNext}) {
  const notCitizen = personalData.residencyStatus && !["Australian Citizen","Permanent Resident"].includes(personalData.residencyStatus);
  const hasMedical = personalData.medicalConditionDeclared === "yes";

  function setDoc(docType, field, value) {
    onChange(docType, {...(docData[docType]||{}), [field]:value});
  }

  return (
    <Card>
      <SectionTitle>Required Documents</SectionTitle>
      <p style={{color:"var(--gray)",fontSize:14,marginBottom:24}}>Please upload all required compliance documents. Accepted formats: PDF, JPG, PNG (max 10MB per file).</p>

      {/* 1. Qualification */}
      <DocSection title="1. Qualification / Enrolment Evidence" color="var(--blue-bg)" border="var(--blue-border)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="Upload Type" required>
            <Select value={docData.qualification?.uploadType||""} onChange={e=>setDoc("qualification","uploadType",e.target.value)}>
              <option value="">Select…</option>
              {["Certificate III in Children Services","Diploma in Children Services","Working towards Certificate III","Working towards Diploma","ECT / Bachelor qualification","Enrolment confirmation","Transcript","Study progress report"].map(t=><option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Training Provider / College">
            <Input value={docData.qualification?.trainingProvider||""} onChange={e=>setDoc("qualification","trainingProvider",e.target.value)} placeholder="Institution name"/>
          </Field>
          <Field label="RTO Number">
            <Input value={docData.qualification?.rtoNumber||""} onChange={e=>setDoc("qualification","rtoNumber",e.target.value)} placeholder="if applicable"/>
          </Field>
          <Field label="Date Commenced">
            <Input type="date" value={docData.qualification?.dateCommenced||""} onChange={e=>setDoc("qualification","dateCommenced",e.target.value)}/>
          </Field>
          <Field label="Expected Completion Date">
            <Input type="date" value={docData.qualification?.expectedCompletionDate||""} onChange={e=>setDoc("qualification","expectedCompletionDate",e.target.value)}/>
          </Field>
          <Field label="Completion Date (if completed)">
            <Input type="date" value={docData.qualification?.completionDate||""} onChange={e=>setDoc("qualification","completionDate",e.target.value)}/>
          </Field>
        </div>
        <UploadField label="Upload Document" status={docData.qualification?.status||"Missing"}
          fileName={docData.qualification?.fileName}
          onUpload={f=>setDoc("qualification","fileName",f.name)}/>
      </DocSection>

      {/* 2. WWVP */}
      <DocSection title="2. Working with Vulnerable People (WWVP) Card" color="var(--teal-light)" border="var(--teal-border)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="WWVP Card Number" required>
            <Input value={docData.wwvp?.cardNumber||""} onChange={e=>setDoc("wwvp","cardNumber",e.target.value)} placeholder="Card number"/>
          </Field>
          <Field label="WWVP Expiry Date" required>
            <Input type="date" value={docData.wwvp?.expiryDate||""} onChange={e=>setDoc("wwvp","expiryDate",e.target.value)}/>
          </Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <UploadField label="Upload Front of Card *" status={docData.wwvp?.status||"Missing"}
            fileName={docData.wwvp?.frontFileName}
            onUpload={f=>setDoc("wwvp","frontFileName",f.name)}/>
          <UploadField label="Upload Back of Card (optional)"
            fileName={docData.wwvp?.backFileName}
            onUpload={f=>setDoc("wwvp","backFileName",f.name)}/>
        </div>
      </DocSection>

      {/* 3. First Aid */}
      <DocSection title="3. First Aid Certificate" color="var(--green-bg)" border="var(--green-border)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
          <Field label="Certificate Type" required>
            <Select value={docData.first_aid?.certType||""} onChange={e=>setDoc("first_aid","certType",e.target.value)}>
              <option value="">Select…</option>
              <option>HLTAID011 – Provide First Aid</option>
              <option>HLTAID012 – Provide First Aid in an Education and Care Setting</option>
              <option>HLTAID009 – Provide Cardiopulmonary Resuscitation</option>
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Issue Date" required>
            <Input type="date" value={docData.first_aid?.issueDate||""} onChange={e=>setDoc("first_aid","issueDate",e.target.value)}/>
          </Field>
          <Field label="Expiry Date" required>
            <Input type="date" value={docData.first_aid?.expiryDate||""} onChange={e=>setDoc("first_aid","expiryDate",e.target.value)}/>
          </Field>
        </div>
        <UploadField label="Upload Certificate *" status={docData.first_aid?.status||"Missing"}
          fileName={docData.first_aid?.fileName}
          onUpload={f=>setDoc("first_aid","fileName",f.name)}/>
      </DocSection>

      {/* 4. Geccko */}
      <DocSection title="4. National Child Safety Training Certificate — Geccko" color="var(--amber-bg)" border="var(--amber-border)">
        <div style={{
          background:"var(--navy)", color:"#fff", borderRadius:8,
          padding:"10px 14px", fontSize:12.5, marginBottom:14, lineHeight:1.6
        }}>
          ⚠️ This training is mandatory for all childcare educators. Educators must upload their certificate of completion from Geccko. Certificates are valid for two years and must be renewed accordingly.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="Completion Date" required>
            <Input type="date" value={docData.geccko_child_safety?.completionDate||""} onChange={e=>setDoc("geccko_child_safety","completionDate",e.target.value)}/>
          </Field>
          <Field label="Certificate Number" required>
            <Input value={docData.geccko_child_safety?.certificateNumber||""} onChange={e=>setDoc("geccko_child_safety","certificateNumber",e.target.value)} placeholder="Certificate number"/>
          </Field>
        </div>
        <UploadField label="Upload Certificate *" status={docData.geccko_child_safety?.status||"Missing"}
          fileName={docData.geccko_child_safety?.fileName}
          onUpload={f=>setDoc("geccko_child_safety","fileName",f.name)}/>
      </DocSection>

      {/* 5. Visa — conditional */}
      {notCitizen && (
        <DocSection title="5. Visa / Work Rights Document" color="var(--red-bg)" border="var(--red-border)">
          <p style={{fontSize:12.5,color:"var(--gray)",marginBottom:14}}>This section is required as you are not listed as an Australian citizen or permanent resident.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Visa Type" required>
              <Input value={docData.visa_work_rights?.visaType||""} onChange={e=>setDoc("visa_work_rights","visaType",e.target.value)} placeholder="e.g. Student Visa (500)"/>
            </Field>
            <Field label="Visa Expiry Date" required>
              <Input type="date" value={docData.visa_work_rights?.expiryDate||""} onChange={e=>setDoc("visa_work_rights","expiryDate",e.target.value)}/>
            </Field>
            <Field label="Residency Status">
              <Input value={docData.visa_work_rights?.residencyStatus||personalData.residencyStatus||""} onChange={e=>setDoc("visa_work_rights","residencyStatus",e.target.value)} placeholder="Status"/>
            </Field>
            <Field label="Work Restriction Details">
              <Input value={docData.visa_work_rights?.workRestrictions||""} onChange={e=>setDoc("visa_work_rights","workRestrictions",e.target.value)} placeholder="Any conditions / hour limits"/>
            </Field>
          </div>
          <UploadField label="Upload Visa / Work Rights Document *" status={docData.visa_work_rights?.status||"Missing"}
            fileName={docData.visa_work_rights?.fileName}
            onUpload={f=>setDoc("visa_work_rights","fileName",f.name)}/>
        </DocSection>
      )}

      {/* 6. Photo ID */}
      <DocSection title="6. Photo ID / Passport" color="var(--blue-bg)" border="var(--blue-border)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="Document Type" required>
            <Select value={docData.photo_id?.docType||""} onChange={e=>setDoc("photo_id","docType",e.target.value)}>
              <option value="">Select…</option>
              <option>Passport</option>
              <option>Driver Licence</option>
              <option>State-issued Photo ID</option>
            </Select>
          </Field>
          <Field label="Expiry Date" required>
            <Input type="date" value={docData.photo_id?.expiryDate||""} onChange={e=>setDoc("photo_id","expiryDate",e.target.value)}/>
          </Field>
        </div>
        <UploadField label="Upload Document *" status={docData.photo_id?.status||"Missing"}
          fileName={docData.photo_id?.fileName}
          onUpload={f=>setDoc("photo_id","fileName",f.name)}/>
      </DocSection>

      {/* 7. Health Statement — conditional */}
      {hasMedical && (
        <DocSection title="7. Personal Health Statement" color="var(--amber-bg)" border="var(--amber-border)">
          <p style={{fontSize:12.5,color:"var(--gray)",marginBottom:14}}>As you indicated a medical condition or injury, please provide a completed Personal Health Statement.</p>
          <Field label="Medical Declaration">
            <textarea value={docData.personal_health_statement?.declaration||""} onChange={e=>setDoc("personal_health_statement","declaration",e.target.value)}
              placeholder="Briefly describe the condition and any relevant work limitations…" rows={4}
              style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid var(--gray-border)",
                fontSize:14,outline:"none",resize:"vertical",fontFamily:"inherit",color:"var(--navy)"}}/>
          </Field>
          <UploadField label="Upload Personal Health Statement" status={docData.personal_health_statement?.status||"Missing"}
            fileName={docData.personal_health_statement?.fileName}
            onUpload={f=>setDoc("personal_health_statement","fileName",f.name)}/>
        </DocSection>
      )}

      <NavButtons onBack={onBack} onNext={onNext} canNext={true}/>
    </Card>
  );
}

// ─── Step 6: Review & Submit ───────────────────────────────────────────────
function CheckRow({label, done}) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
      background: done ? "var(--green-bg)" : "var(--red-bg)",
      border:`1px solid ${done ? "var(--green-border)" : "var(--red-border)"}`,
      borderRadius:8, marginBottom:8
    }}>
      <span style={{fontSize:18, color: done ? "var(--green)" : "var(--red)"}}>{done ? "✓" : "✗"}</span>
      <span style={{fontSize:14, color:"var(--navy)", fontWeight:500}}>{label}</span>
      <Badge status={done?"Approved":"Missing"} size="sm"/>
    </div>
  );
}

function StepReview({personalData, emergData, contractData, qualData, docData, onBack, onSubmit, submitted}) {
  const notCitizen = personalData.residencyStatus && !["Australian Citizen","Permanent Resident"].includes(personalData.residencyStatus);
  const hasMedical = personalData.medicalConditionDeclared === "yes";

  const checks = [
    {label:"Personal details completed", done:!!(personalData.firstName&&personalData.lastName&&personalData.email)},
    {label:"Emergency contact completed", done:!!(emergData.emergencyName&&emergData.emergencyMobile)},
    {label:"Employment contract accepted", done:!!(contractData.iAgree&&contractData.fullName)},
    {label:"Qualification details completed", done:!!(qualData.qualificationStatus&&qualData.qualificationName)},
    {label:"WWVP Card uploaded", done:!!(docData.wwvp?.frontFileName||docData.wwvp?.status==="Approved")},
    {label:"First Aid Certificate uploaded", done:!!(docData.first_aid?.fileName||docData.first_aid?.status==="Approved")},
    {label:"Geccko Child Safety Certificate uploaded", done:!!(docData.geccko_child_safety?.fileName||docData.geccko_child_safety?.status==="Approved")},
    ...(notCitizen ? [{label:"Visa / Work Rights document uploaded", done:!!(docData.visa_work_rights?.fileName)}] : []),
    {label:"Photo ID uploaded", done:!!(docData.photo_id?.fileName||docData.photo_id?.status==="Approved")},
    ...(hasMedical ? [{label:"Personal Health Statement uploaded", done:!!(docData.personal_health_statement?.fileName)}] : []),
  ];

  if (submitted) return (
    <Card style={{textAlign:"center",padding:"60px 40px"}}>
      <div style={{fontSize:64,marginBottom:20}}>✅</div>
      <div style={{fontFamily:"'DM Serif Display',serif",fontSize:28,color:"var(--navy)",marginBottom:12}}>Submission Complete</div>
      <p style={{fontSize:15,color:"var(--gray)",maxWidth:460,margin:"0 auto",lineHeight:1.7}}>
        Thank you. Your onboarding and compliance documents have been submitted to Right Tick Recruitment for review. You will be contacted if any correction is required.
      </p>
      <div style={{marginTop:28,padding:"16px 24px",background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:10,display:"inline-block"}}>
        <span style={{color:"var(--green)",fontWeight:600,fontSize:14}}>Please note: shifts can only be allocated once all documents are approved.</span>
      </div>
    </Card>
  );

  return (
    <Card>
      <SectionTitle>Review & Submit</SectionTitle>
      <p style={{color:"var(--gray)",fontSize:14,marginBottom:24}}>Please review your checklist below before submitting. All items should be ticked before you submit for review.</p>

      <div style={{marginBottom:28}}>
        <h4 style={{fontSize:13,fontWeight:700,color:"var(--navy)",marginBottom:12,textTransform:"uppercase",letterSpacing:0.7}}>Onboarding Checklist</h4>
        {checks.map((c,i)=><CheckRow key={i} {...c}/>)}
      </div>

      {/* Personal details summary */}
      <div style={{background:"var(--gray-light)",borderRadius:10,padding:"20px 24px",marginBottom:24}}>
        <h4 style={{fontSize:13,fontWeight:700,color:"var(--gray)",marginBottom:12,textTransform:"uppercase",letterSpacing:0.7}}>Summary</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:14}}>
          {[
            ["Name", `${personalData.firstName||""} ${personalData.lastName||""}`],
            ["Email", personalData.email||"—"],
            ["Mobile", personalData.mobile||"—"],
            ["Residency", personalData.residencyStatus||"—"],
            ["Qualification", qualData.qualificationStatus||"—"],
            ["Contract signed by", contractData.fullName||"—"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:6}}>
              <span style={{color:"var(--gray)",minWidth:110}}>{k}:</span>
              <span style={{color:"var(--navy)",fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"var(--amber-bg)",border:"1px solid var(--amber-border)",borderRadius:8,padding:"12px 16px",marginBottom:20,fontSize:13,color:"var(--amber)"}}>
        By clicking Submit for Review you confirm that all information provided is accurate and complete.
      </div>

      <NavButtons onBack={onBack} onNext={onSubmit} nextLabel="Submit for Review ✓"
        canNext={checks.filter(c=>c.label.includes("WWVP")||c.label.includes("First Aid")||c.label.includes("Geccko")||c.label.includes("Personal details")||c.label.includes("Emergency")).every(c=>c.done)}/>
    </Card>
  );
}

// ─── Educator Wizard ────────────────────────────────────────────────────────
function EducatorPortal() {
  const [step, setStep] = useState(0);
  const [personalData, setPersonalData] = useState({});
  const [emergData, setEmergData] = useState({});
  const [contractData, setContractData] = useState({});
  const [qualData, setQualData] = useState({});
  const [docData, setDocData] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function upd(setter) { return (k,v) => setter(p=>({...p,[k]:v})); }

  const stepComponents = [
    <StepPersonal data={personalData} onChange={upd(setPersonalData)} onNext={()=>setStep(1)}/>,
    <StepEmergency data={{...emergData,...personalData}} onChange={upd(setEmergData)} onBack={()=>setStep(0)} onNext={()=>setStep(2)}/>,
    <StepContract data={contractData} onChange={upd(setContractData)} onBack={()=>setStep(1)} onNext={()=>setStep(3)}/>,
    <StepQualifications data={{...qualData,...personalData}} onChange={upd(setQualData)} onBack={()=>setStep(2)} onNext={()=>setStep(4)}/>,
    <StepDocuments personalData={personalData} qualData={qualData} docData={docData}
      onChange={(k,v)=>setDocData(p=>({...p,[k]:v}))} onBack={()=>setStep(3)} onNext={()=>setStep(5)}/>,
    <StepReview personalData={personalData} emergData={emergData} contractData={contractData}
      qualData={qualData} docData={docData} onBack={()=>setStep(4)}
      onSubmit={()=>setSubmitted(true)} submitted={submitted}/>,
  ];

  return (
    <div style={{maxWidth:860,margin:"0 auto",padding:"0 0 60px"}}>
      <ProgressBar current={step}/>
      <div style={{padding:"28px 24px"}}>
        {stepComponents[step]}
      </div>
    </div>
  );
}

// ─── Admin Dashboard ────────────────────────────────────────────────────────
function AdminDashboard() {
  const [educators, setEducators] = useState(SAMPLE_EDUCATORS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [adminNote, setAdminNote] = useState("");

  const DOC_LABELS = {
    qualification:"Qualification", wwvp:"WWVP Card",
    first_aid:"First Aid", geccko_child_safety:"Geccko Child Safety",
    visa_work_rights:"Visa / Work Rights", photo_id:"Photo ID",
    personal_health_statement:"Health Statement"
  };

  const filtered = educators.filter(e=>{
    const nameMatch = `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase());
    const statusMatch = !filterStatus || e.overallStatus === filterStatus;
    return nameMatch && statusMatch;
  });

  function updateEducator(id, updates) {
    setEducators(eds => eds.map(e => e.educatorId===id ? {...e,...updates} : e));
    if (selected?.educatorId===id) setSelected(e=>({...e,...updates}));
  }

  function updateDocStatus(eduId, docKey, status, note="") {
    setEducators(eds => eds.map(e => {
      if (e.educatorId!==eduId) return e;
      return {...e, docs:{...e.docs, [docKey]:{...e.docs[docKey], status, note:note||e.docs[docKey]?.note}}};
    }));
    if (selected?.educatorId===eduId) {
      setSelected(e=>({...e, docs:{...e.docs, [docKey]:{...e.docs[docKey], status, note}}}));
    }
  }

  // Summary stats
  const stats = {
    total: educators.length,
    approved: educators.filter(e=>e.overallStatus==="Approved").length,
    pending: educators.filter(e=>e.overallStatus==="Submitted for Review").length,
    expiring: educators.filter(e=>e.overallStatus==="Expiring Soon").length,
  };

  return (
    <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 24px 60px"}}>
      <div style={{marginBottom:28}}>
        <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,color:"var(--navy)",marginBottom:4}}>Admin Dashboard</h2>
        <p style={{color:"var(--gray)",fontSize:14}}>Right Tick Recruitment — Educator Compliance Management</p>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:28}}>
        {[
          {label:"Total Educators", value:stats.total, color:"var(--navy)"},
          {label:"Approved", value:stats.approved, color:"var(--green)"},
          {label:"Awaiting Review", value:stats.pending, color:"var(--blue)"},
          {label:"Expiring Soon", value:stats.expiring, color:"var(--amber)"},
        ].map(s=>(
          <div key={s.label} style={{background:"#fff",borderRadius:12,border:"1px solid var(--gray-border)",padding:"20px 24px",boxShadow:"var(--shadow)"}}>
            <div style={{fontSize:12,color:"var(--gray)",fontWeight:600,textTransform:"uppercase",letterSpacing:0.7,marginBottom:8}}>{s.label}</div>
            <div style={{fontSize:32,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:selected?"1fr 420px":"1fr",gap:20}}>
        {/* Educator Table */}
        <div>
          {/* Filters */}
          <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search by name…"
              style={{flex:"1 1 200px",padding:"9px 14px",borderRadius:8,border:"1.5px solid var(--gray-border)",fontSize:14,outline:"none"}}/>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid var(--gray-border)",fontSize:14,background:"#fff",minWidth:180}}>
              <option value="">All Statuses</option>
              {["Approved","Submitted for Review","Needs Correction","Incomplete","Expiring Soon","Inactive"].map(s=><option key={s}>{s}</option>)}
            </select>
            <button style={{padding:"9px 16px",borderRadius:8,border:"1.5px solid var(--gray-border)",background:"#fff",fontSize:13,fontWeight:600,color:"var(--navy)"}}>
              Export CSV ↓
            </button>
          </div>

          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--gray-border)",overflow:"hidden",boxShadow:"var(--shadow)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"var(--gray-light)"}}>
                  {["Educator","Qualification","WWVP Expiry","First Aid Expiry","Overall Status","Actions"].map(h=>(
                    <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"var(--gray)",textTransform:"uppercase",letterSpacing:0.5,borderBottom:"1px solid var(--gray-border)"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((edu,i)=>(
                  <tr key={edu.educatorId} style={{
                    borderBottom:"1px solid var(--gray-border)",
                    background: selected?.educatorId===edu.educatorId ? "var(--blue-bg)" : i%2===0?"#fff":"var(--gray-light)",
                    cursor:"pointer"
                  }} onClick={()=>setSelected(edu)}>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{
                          width:34,height:34,borderRadius:"50%",
                          background:"var(--navy)",color:"#fff",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:13,fontWeight:700,flexShrink:0
                        }}>{edu.firstName[0]}{edu.lastName[0]}</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:"var(--navy)"}}>{edu.firstName} {edu.lastName}</div>
                          <div style={{fontSize:12,color:"var(--gray)"}}>{edu.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px",fontSize:13,color:"var(--navy)"}}>{edu.qualificationStatus}</td>
                    <td style={{padding:"12px 14px",fontSize:13,color:!edu.wwvpExpiry?"var(--red)":"var(--navy)"}}>{edu.wwvpExpiry||"—"}</td>
                    <td style={{padding:"12px 14px",fontSize:13,color:!edu.firstAidExpiry?"var(--red)":"var(--navy)"}}>{edu.firstAidExpiry||"—"}</td>
                    <td style={{padding:"12px 14px"}}><Badge status={edu.overallStatus}/></td>
                    <td style={{padding:"12px 14px"}}>
                      <button onClick={e=>{e.stopPropagation();setSelected(edu)}}
                        style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--gray-border)",background:"#fff",fontSize:12,fontWeight:600,color:"var(--navy)"}}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--gray-border)",boxShadow:"var(--shadow)",overflow:"hidden",alignSelf:"start"}}>
            <div style={{background:"var(--navy)",padding:"18px 20px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:19}}>{selected.firstName} {selected.lastName}</div>
                <div style={{fontSize:12,color:"#aab8d4",marginTop:2}}>{selected.email} &bull; {selected.mobile}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:6,padding:"4px 10px",fontSize:18,cursor:"pointer"}}>×</button>
            </div>

            <div style={{padding:"16px 20px"}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <Badge status={selected.overallStatus} size="md"/>
                {selected.submittedAt && <span style={{fontSize:12,color:"var(--gray)",alignSelf:"center"}}>Submitted {selected.submittedAt}</span>}
              </div>

              {/* Admin status actions */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--gray)",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>Update Educator Status</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["Approved","Needs Correction","Inactive"].map(s=>(
                    <button key={s} onClick={()=>updateEducator(selected.educatorId,{overallStatus:s})}
                      style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--gray-border)",background: selected.overallStatus===s?"var(--navy)":"#fff",
                        color:selected.overallStatus===s?"#fff":"var(--navy)",fontSize:12,fontWeight:600}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document statuses */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--gray)",textTransform:"uppercase",letterSpacing:0.6,marginBottom:10}}>Documents</div>
                {Object.entries(selected.docs||{}).map(([key,doc])=>(
                  <div key={key} style={{marginBottom:8,padding:"10px 12px",borderRadius:8,border:"1px solid var(--gray-border)",background:"var(--gray-light)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:doc.note?6:0}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--navy)"}}>{DOC_LABELS[key]||key}</span>
                      <Badge status={doc.status} size="sm"/>
                    </div>
                    {doc.note && <div style={{fontSize:12,color:"var(--red)",marginBottom:6}}>Note: {doc.note}</div>}
                    <div style={{display:"flex",gap:6,marginTop:6}}>
                      {["Approved","Rejected","Needs Review"].map(s=>(
                        <button key={s} onClick={()=>updateDocStatus(selected.educatorId,key,s)}
                          style={{padding:"4px 8px",borderRadius:4,border:"1px solid var(--gray-border)",
                            background:doc.status===s?"var(--navy)":"#fff",
                            color:doc.status===s?"#fff":"var(--navy)",fontSize:11,fontWeight:600}}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin note */}
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"var(--gray)",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Add Admin Note</div>
                <textarea value={adminNote} onChange={e=>setAdminNote(e.target.value)}
                  placeholder="Add a note for this educator (will be included in correction email)…" rows={3}
                  style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid var(--gray-border)",
                    fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit",color:"var(--navy)",marginBottom:8}}/>
                <div style={{display:"flex",gap:8}}>
                  <button style={{flex:1,padding:"8px",borderRadius:7,border:"1.5px solid var(--amber-border)",
                    background:"var(--amber-bg)",color:"var(--amber)",fontSize:12,fontWeight:700}}>
                    Send Correction Request
                  </button>
                  <button style={{flex:1,padding:"8px",borderRadius:7,border:"1.5px solid var(--green-border)",
                    background:"var(--green-bg)",color:"var(--green)",fontSize:12,fontWeight:700}}>
                    Send Approval Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App Root ──────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("educator");

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{minHeight:"100vh",background:"#f0f4f8"}}>
        <Header view={view} onSwitch={setView} educatorName={view==="educator"?"New Educator":undefined}/>
        {view==="educator" ? <EducatorPortal/> : <AdminDashboard/>}
      </div>
    </>
  );
}
