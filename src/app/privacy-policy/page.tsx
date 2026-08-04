import { formatAbsoluteDateKo } from '@/lib/format-date';

/** 방침 시행일 — 본문을 개정할 때 함께 갱신합니다. */
const PRIVACY_EFFECTIVE_DATE = '2026-08-04';

export default function PrivacyPolicyPage() {
  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl space-y-8'>
        {/* Main Heading */}
        <h1 className='text-foreground text-3xl font-bold'>개인정보처리방침</h1>

        {/* 총칙 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>총칙</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            주식회사 웨이크(이하 &ldquo;회사&rdquo;)는 사내 업무 지원 시스템 WakeOne(이하
            &ldquo;서비스&rdquo;)을 운영하면서 「개인정보 보호법」 등 관련 법령을 준수하고,
            정보주체의 개인정보를 보호하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
          </p>
        </section>

        {/* 1. 수집 항목 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            1. 수집하는 개인정보의 항목 및 수집 방법
          </h2>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>
              <span className='text-foreground font-medium'>계정·프로필 정보</span>: 이름, 이메일
              주소, 휴대전화번호, 생년월일(생일), 소속, 직급, 프로필 이미지, 계정 권한·상태
            </li>
            <li>
              <span className='text-foreground font-medium'>인증 정보</span>: 비밀번호(암호화 저장),
              로그인 이력, 세션 정보
            </li>
            <li>
              <span className='text-foreground font-medium'>업무 처리 과정에서 생성되는 정보</span>:
              계약 문서의 기안자 이름·이메일, 계약 상대방·계약 내용·금액 등 문서 정보, 첨부파일,
              법인카드 월 한도 및 잔여 한도, 알림 수신 이력
            </li>
            <li>
              <span className='text-foreground font-medium'>자동으로 수집되는 정보</span>: 서비스
              이용 기록(수행 작업, 요청 경로·처리 결과, 발생 일시 등 활동 로그), 시스템 메일 발송
              이력(수신자 이메일, 발송 상태)
            </li>
          </ul>
          <p className='text-muted-foreground mt-3 text-base leading-relaxed'>
            수집 방법: 관리자의 사용자 계정 등록, 이용자의 프로필 입력·수정, 서비스 이용 과정에서의
            자동 생성, 외부 연동 시스템(계약 문서 연동, 법인카드 한도 연동)을 통한 수집.
          </p>
        </section>

        {/* 2. 처리 목적 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>2. 개인정보의 처리 목적</h2>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>계정 발급·본인 식별 및 로그인, 접근 권한 관리</li>
            <li>계약 문서 관리, 첨부 누락 안내 등 업무 처리 및 관련 안내 메일 발송</li>
            <li>법인카드 한도 조회 등 사내 자원 운영 지원</li>
            <li>생일자 안내 등 사내 복리후생 및 소통 지원</li>
            <li>부정 이용 방지, 접근 이력 관리, 장애 대응 및 서비스 품질 개선</li>
          </ul>
        </section>

        {/* 3. 처리 근거 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>3. 개인정보의 처리 근거</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 「개인정보 보호법」 제15조 제1항 제4호(계약의 이행)에 따라 근로계약 및 사내
            인사·총무 업무 수행에 필요한 범위에서, 같은 항 제2호·제3호(법령상 의무 준수 및 소관 업무
            수행) 및 제6호(정당한 이익)에 따라 서비스 보안·운영에 필요한 범위에서 개인정보를
            처리합니다. 별도의 동의가 필요한 항목은 사전에 동의를 받아 처리합니다.
          </p>
        </section>

        {/* 4. 보유 및 이용 기간 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            4. 개인정보의 보유 및 이용 기간
          </h2>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>
              <span className='text-foreground font-medium'>계정 및 프로필 정보</span>: 이용 자격
              상실(퇴직 등) 시까지. 이후 회사 내부 기준 및 관계 법령에 따른 기간 동안 보관 후 파기
            </li>
            <li>
              <span className='text-foreground font-medium'>계약 문서 및 첨부파일</span>: 관계
              법령에서 정한 계약·거래 관련 기록 보존 기간 동안 보관
            </li>
            <li>
              <span className='text-foreground font-medium'>활동 로그·시스템 메일 발송 이력</span>:
              보안 및 감사 목적으로 회사 내부 기준에 따라 보관 후 파기
            </li>
            <li>
              <span className='text-foreground font-medium'>법령에 따른 보존</span>:
              「전자상거래법」, 「국세기본법」 등 관계 법령에서 정한 기간
            </li>
          </ul>
        </section>

        {/* 5. 제3자 제공 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>5. 개인정보의 제3자 제공</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 정보주체의 개인정보를 제2항의 처리 목적 범위를 초과하여 이용하거나 제3자에게
            제공하지 않습니다. 다만 정보주체가 사전에 동의한 경우, 법령에 특별한 규정이 있거나
            수사기관이 법령에 정한 절차와 방법에 따라 요구하는 경우에는 예외로 합니다. 회사는
            개인정보를 판매하거나 마케팅 목적으로 제공하지 않습니다.
          </p>
        </section>

        {/* 6. 처리위탁 및 국외 이전 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            6. 개인정보 처리의 위탁 및 국외 이전
          </h2>
          <p className='text-muted-foreground mb-3 text-base leading-relaxed'>
            회사는 안정적인 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있으며,
            수탁자가 관련 법령을 준수하도록 관리·감독하고 있습니다.
          </p>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>
              <span className='text-foreground font-medium'>Supabase, Inc.</span> — 데이터베이스
              운영, 인증·세션 관리, 파일 저장 (미국 등 서비스 제공 리전)
            </li>
            <li>
              <span className='text-foreground font-medium'>Vercel, Inc.</span> — 애플리케이션
              호스팅 및 서비스 운영 (미국 등)
            </li>
            <li>
              <span className='text-foreground font-medium'>메일 발송 서비스 제공자(SMTP)</span> —
              안내 메일 발송 (서비스 제공자 소재 국가)
            </li>
          </ul>
          <p className='text-muted-foreground mt-3 text-base leading-relaxed'>
            이전되는 항목은 각 위탁 업무 수행에 필요한 최소한의 정보이며, 이전 시기·방법은 서비스
            이용 시점에 정보통신망을 통한 전송 방식으로 이루어집니다. 위탁 업무의 내용이나 수탁자가
            변경되는 경우 본 방침을 통해 공개합니다.
          </p>
        </section>

        {/* 7. 파기 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            7. 개인정보의 파기 절차 및 방법
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를
            파기합니다. 전자적 파일 형태의 정보는 복구·재생이 불가능한 방법으로 영구 삭제하며,
            출력물 형태의 정보는 분쇄하거나 소각합니다. 다른 법령에 따라 보존해야 하는 경우에는
            별도의 저장 공간에 분리하여 보관합니다.
          </p>
        </section>

        {/* 8. 정보주체의 권리 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            8. 정보주체의 권리·의무 및 행사 방법
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            정보주체는 언제든지 개인정보의 열람, 정정·삭제, 처리정지를 요구할 수 있습니다. 프로필
            정보의 일부는 서비스 내 프로필 화면에서 직접 확인·수정할 수 있으며, 그 밖의 요구는 아래
            문의처를 통해 서면·이메일 등으로 접수할 수 있습니다. 회사는 요구를 받은 날부터 10일
            이내에 조치하고 그 결과를 통지합니다. 다만 법령에서 정한 사유에 해당하는 경우 요구가
            제한될 수 있습니다.
          </p>
        </section>

        {/* 9. 안전성 확보 조치 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            9. 개인정보의 안전성 확보 조치
          </h2>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>
              접근 권한 최소화: 권한(관리자/일반)에 따른 접근 통제 및 데이터베이스 행 단위 접근
              제어(RLS) 적용
            </li>
            <li>접근 기록 관리: 주요 작업에 대한 활동 로그 기록 및 보관</li>
            <li>암호화: 비밀번호 일방향 암호화 저장, 통신 구간 HTTPS 암호화</li>
            <li>첨부파일 보호: 인증된 이용자만 접근 가능한 저장소 운영 및 다운로드 통제</li>
            <li>퇴직·권한 변경 시 계정 비활성화 및 세션 회수</li>
          </ul>
        </section>

        {/* 10. 쿠키 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            10. 쿠키 등 자동 수집 장치의 운영
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 로그인 상태 유지 및 보안을 위해 인증 세션 쿠키를 사용합니다. 이용자는 브라우저
            설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 서비스 이용에 제한이 있을 수
            있습니다. 회사는 광고·행태정보 수집 목적의 쿠키를 사용하지 않습니다.
          </p>
        </section>

        {/* 11. 보호책임자 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            11. 개인정보 보호책임자 및 문의처
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의
            문의·불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고
            있습니다.
          </p>
          <ul className='text-muted-foreground mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>
              <span className='text-foreground font-medium'>개인정보 보호책임자</span>: 홍성훈
              (총무팀)
            </li>
            <li>
              <span className='text-foreground font-medium'>문의처</span>:{' '}
              <a
                href='mailto:info@wakecorp.com'
                className='text-primary font-medium hover:underline'
              >
                info@wakecorp.com
              </a>
            </li>
          </ul>
          <p className='text-muted-foreground mt-3 text-base leading-relaxed'>
            정보주체는 서비스 이용 중 발생한 모든 개인정보 보호 관련 문의, 불만 처리, 피해 구제 등에
            관한 사항을 개인정보 보호책임자에게 문의할 수 있으며, 회사는 지체 없이 답변 및
            처리하겠습니다.
          </p>
          <p className='text-muted-foreground mt-3 text-base leading-relaxed'>
            그 밖에 개인정보 침해에 대한 신고·상담이 필요한 경우 개인정보침해신고센터
            (privacy.kisa.or.kr, 국번없이 118), 개인정보 분쟁조정위원회(kopico.go.kr, 1833-6972),
            대검찰청 사이버수사과(spo.go.kr, 1301), 경찰청 사이버수사국(ecrm.police.go.kr, 182)에
            문의하실 수 있습니다.
          </p>
        </section>

        {/* 12. 방침의 변경 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            12. 개인정보처리방침의 변경
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            본 방침은 {formatAbsoluteDateKo(PRIVACY_EFFECTIVE_DATE)}부터 적용됩니다. 법령·정책 또는
            서비스 내용의 변경에 따라 내용이 추가·삭제·수정되는 경우 변경 사항의 시행 7일 전부터
            서비스 내 공지를 통해 안내합니다.
          </p>
        </section>

        {/* Last Updated */}
        <div className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-sm'>
            시행일: {formatAbsoluteDateKo(PRIVACY_EFFECTIVE_DATE)}
          </p>
        </div>
      </div>
    </div>
  );
}
