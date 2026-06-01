import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, UserCircle2, ArrowLeft, Check, Sparkles, Plus, ArrowRight } from "lucide-react";
import type { Organization, Employee, UserRole } from "../types";
import { useOrganizations, useEmployees, useCreateOrganization, useCreateEmployee } from "../hooks/queries";
import { useSession } from "../app/SessionContext";
import { Button, Input, Label, Avatar, useToast, Spinner } from "../ui";
import { Brand } from "../components/Brand";
import { cn } from "../lib/utils";

type Step = "role" | "org" | "employee";

const ROLES: { id: UserRole; title: string; desc: string; icon: React.ReactNode }[] = [
  { id: "consultant", title: "咨询顾问", desc: "外部专业顾问：选择客户企业，主导诊断 Engagement、访谈员工、生成交付物", icon: <Users size={20} /> },
  { id: "admin", title: "企业管理员", desc: "企业内部管理者：查看本企业流程全景、员工协作网络与综合分析报告", icon: <Building2 size={20} /> },
  { id: "employee", title: "员工", desc: "企业成员：选择你自己，接受 AI 访谈，梳理你的工作流程、痛点与系统依赖", icon: <UserCircle2 size={20} /> },
];

const ROLE_DEFAULT_NAME: Record<UserRole, string> = { consultant: "咨询顾问", admin: "企业管理员", employee: "" };

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn } = useSession();

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<UserRole>("consultant");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [displayName, setDisplayName] = useState(""); // consultant / admin self-name (no employee binding)

  const orgs = useOrganizations();
  const employees = useEmployees(role === "employee" && selectedOrg ? selectedOrg.id : undefined);
  const createOrg = useCreateOrganization();
  const createEmp = useCreateEmployee(selectedOrg?.id ?? "");

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgIndustry, setNewOrgIndustry] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("");

  const isEmployee = role === "employee";

  // Consultant / admin: choosing an org enters immediately (no employee identity).
  const enterAsStaff = (org: Organization) => {
    const name = displayName.trim() || ROLE_DEFAULT_NAME[role];
    signIn({ orgId: org.id, orgName: org.name, empId: "", empName: name, role });
    navigate(role === "admin" ? "/overview" : "/engagements", { replace: true });
  };

  const enterAsEmployee = () => {
    if (!selectedOrg || !selectedEmp) return;
    signIn({ orgId: selectedOrg.id, orgName: selectedOrg.name, empId: selectedEmp.id, empName: selectedEmp.name, role: "employee" });
    navigate("/portal", { replace: true });
  };

  const chooseOrg = (org: Organization) => {
    setSelectedOrg(org);
    if (isEmployee) setStep("employee");
    else enterAsStaff(org);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    try {
      const org = await createOrg.mutateAsync({ name: newOrgName.trim(), industry: newOrgIndustry.trim() || undefined });
      setNewOrgName(""); setNewOrgIndustry("");
      toast.success("企业已创建", org.name);
      chooseOrg(org);
    } catch (e) {
      toast.error("创建企业失败", e instanceof Error ? e.message : undefined);
    }
  };

  const handleCreateEmp = async () => {
    if (!selectedOrg || !newEmpName.trim() || !newEmpRole.trim()) return;
    try {
      const emp = await createEmp.mutateAsync({
        organizationId: selectedOrg.id, name: newEmpName.trim(),
        role: newEmpRole.trim(), department: newEmpDept.trim() || undefined,
      });
      setSelectedEmp(emp);
      setNewEmpName(""); setNewEmpRole(""); setNewEmpDept("");
      toast.success("成员已添加", emp.name);
    } catch (e) {
      toast.error("添加成员失败", e instanceof Error ? e.message : undefined);
    }
  };

  const steps = isEmployee ? ["选择角色", "选择企业", "选择身份"] : ["选择角色", "选择企业"];
  const stepIndex = step === "role" ? 0 : step === "org" ? 1 : 2;

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <aside className="hidden lg:flex flex-col justify-between w-[42%] max-w-xl p-12 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, var(--brand-navy) 0%, #1a2f5c 55%, var(--accent-active) 130%)" }}>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -left-16 bottom-10 h-72 w-72 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <Brand size={40} compact className="[&_*]:!text-white" />
        </div>
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-xs font-semibold backdrop-blur">
            <Sparkles size={13} /> AI 驱动的战略咨询工作台
          </div>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-balance">
            像顶级咨询公司一样<br />诊断你的组织
          </h1>
          <p className="text-white/70 text-[15px] leading-relaxed max-w-md">
            从结构化访谈到流程数字孪生，从假设验证到金字塔原理交付物——
            把麦肯锡级方法论装进一个可协作、可追溯、可交付的工作台。
          </p>
          <div className="flex gap-8 pt-4">
            {[["访谈", "AI 苏格拉底式提问"], ["诊断", "16 类流程缺口检测"], ["交付", "证据链驱动洞察"]].map(([k, v]) => (
              <div key={k}>
                <div className="text-2xl font-bold">{k}</div>
                <div className="text-xs text-white/60 mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/40">工程控制论实践 · 闭环 · 可观测 · 资源有界</div>
      </aside>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-bg">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center"><Brand size={40} /></div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={cn("flex items-center gap-2 px-1 transition-opacity", i <= stepIndex ? "opacity-100" : "opacity-40")}>
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                    i < stepIndex ? "bg-accent text-white" : i === stepIndex ? "bg-accent text-white ring-4 ring-[var(--ring)]" : "bg-muted text-fg-tertiary",
                  )}>
                    {i < stepIndex ? <Check size={13} /> : i + 1}
                  </div>
                  <span className="text-xs font-semibold text-fg hidden sm:inline">{label}</span>
                </div>
                {i < steps.length - 1 && <div className={cn("w-6 h-px", i < stepIndex ? "bg-accent" : "bg-border")} />}
              </div>
            ))}
          </div>

          {step === "role" && (
            <div className="animate-fade-up space-y-3">
              <header className="mb-5">
                <h2 className="text-xl font-bold text-fg">选择你的角色</h2>
                <p className="text-sm text-fg-tertiary mt-1">不同角色拥有完全不同的工作台与权限</p>
              </header>
              {ROLES.map((r) => (
                <button key={r.id} onClick={() => { setRole(r.id); setStep("org"); }}
                  className={cn(
                    "w-full flex items-start gap-3.5 p-4 rounded-xl border-2 text-left transition-all cursor-pointer",
                    role === r.id ? "border-accent bg-accent-light" : "border-border bg-card hover:border-border-strong",
                  )}>
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    role === r.id ? "bg-accent text-white" : "bg-muted text-fg-secondary")}>{r.icon}</div>
                  <div>
                    <div className="text-[15px] font-semibold text-fg">{r.title}</div>
                    <div className="text-[12.5px] text-fg-tertiary mt-1 leading-relaxed">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "org" && (
            <div className="animate-fade-up">
              <header className="mb-5">
                <h2 className="text-xl font-bold text-fg">{(orgs.data?.length ?? 0) > 0 ? (isEmployee ? "选择或创建企业" : "选择要进入的企业") : "创建你的第一个企业"}</h2>
                <p className="text-sm text-fg-tertiary mt-1">
                  {role === "consultant" && "选择你要服务的客户企业，进入项目中心"}
                  {role === "admin" && "选择你所在的企业，进入企业总览"}
                  {role === "employee" && "企业是流程数据与成员归属的边界"}
                </p>
              </header>

              {!isEmployee && (
                <div className="mb-4">
                  <Label>你的姓名（选填，用于署名）</Label>
                  <Input placeholder={ROLE_DEFAULT_NAME[role]} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
              )}

              {orgs.isLoading && <div className="py-6 flex justify-center"><Spinner /></div>}
              {(orgs.data?.length ?? 0) > 0 && (
                <div className="space-y-2 mb-5 max-h-52 overflow-y-auto pr-1">
                  {orgs.data!.map((o) => (
                    <button key={o.id} onClick={() => chooseOrg(o)}
                      className="w-full group flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card hover:border-accent hover:bg-accent-light transition-all text-left cursor-pointer">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-fg-secondary"><Building2 size={17} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-fg truncate">{o.name}</div>
                        {o.industry && <div className="text-xs text-fg-tertiary truncate">{o.industry}</div>}
                      </div>
                      {!isEmployee && <ArrowRight size={16} className="text-fg-tertiary group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Commercial rule: only consultants onboard (create) client companies. */}
              {role === "consultant" ? (
                <div className="border-t border-border-light pt-4 space-y-3">
                  <p className="text-xs text-fg-tertiary">或者为新客户开通企业</p>
                  <Input placeholder="企业名称" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()} />
                  <Input placeholder="行业（选填）" value={newOrgIndustry} onChange={(e) => setNewOrgIndustry(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()} />
                  <Button className="w-full" loading={createOrg.isPending} disabled={!newOrgName.trim()} leftIcon={<Plus size={16} />} onClick={handleCreateOrg}>
                    开通并进入
                  </Button>
                </div>
              ) : (
                !orgs.isLoading && (orgs.data?.length ?? 0) === 0 && (
                  <div className="border-t border-border-light pt-4">
                    <div className="p-3.5 rounded-lg bg-muted text-fg-secondary text-[12.5px] leading-relaxed">
                      尚无已开通的企业。企业需由<span className="font-semibold text-fg">咨询顾问</span>开通后，你才能进入。请联系你的对接顾问。
                    </div>
                  </div>
                )
              )}
              <Button variant="ghost" size="sm" className="mt-4" leftIcon={<ArrowLeft size={14} />} onClick={() => setStep("role")}>返回</Button>
            </div>
          )}

          {step === "employee" && selectedOrg && (
            <div className="animate-fade-up">
              <header className="mb-4 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-light text-accent text-xs font-semibold mb-3">
                  <Building2 size={12} /> {selectedOrg.name}
                </span>
                <h2 className="text-xl font-bold text-fg">{(employees.data?.length ?? 0) > 0 ? "选择或创建你自己" : "创建你的成员档案"}</h2>
                <p className="text-sm text-fg-tertiary mt-1">选择你本人，AI 将围绕你的岗位展开访谈</p>
              </header>

              {employees.isLoading && <div className="py-6 flex justify-center"><Spinner /></div>}
              {(employees.data?.length ?? 0) > 0 && (
                <div className="space-y-2 mb-5 max-h-48 overflow-y-auto pr-1">
                  {employees.data!.map((e) => (
                    <button key={e.id} onClick={() => setSelectedEmp(e)}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left cursor-pointer",
                        selectedEmp?.id === e.id ? "border-accent bg-accent-light" : "border-border bg-card hover:border-border-strong")}>
                      <Avatar name={e.name} size={36} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-fg truncate">{e.name}</div>
                        <div className="text-xs text-fg-tertiary truncate">{e.role}{e.department ? ` · ${e.department}` : ""}</div>
                      </div>
                      {selectedEmp?.id === e.id && <Check size={16} className="text-accent ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-border-light pt-4 space-y-3">
                <p className="text-xs text-fg-tertiary">或者创建你的档案</p>
                <Input placeholder="姓名" value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} />
                <div className="flex gap-2">
                  <Input placeholder="职位" value={newEmpRole} onChange={(e) => setNewEmpRole(e.target.value)} />
                  <Input placeholder="部门（选填）" value={newEmpDept} onChange={(e) => setNewEmpDept(e.target.value)} />
                </div>
                <Button variant="outline" className="w-full" loading={createEmp.isPending} disabled={!newEmpName.trim() || !newEmpRole.trim()} leftIcon={<Plus size={16} />} onClick={handleCreateEmp}>添加并选择</Button>
              </div>

              <div className="flex gap-2 mt-5">
                <Button variant="ghost" leftIcon={<ArrowLeft size={14} />} onClick={() => { setStep("org"); setSelectedEmp(null); }}>返回</Button>
                <Button className="flex-1" disabled={!selectedEmp} onClick={enterAsEmployee}>进入资料采集</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
