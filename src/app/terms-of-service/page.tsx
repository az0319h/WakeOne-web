import { formatAbsoluteDateKo } from '@/lib/format-date';

/** 약관 시행일 — 약관 본문을 개정할 때 함께 갱신합니다. */
const TERMS_EFFECTIVE_DATE = '2026-08-04';

export default function TermsOfServicePage() {
  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl space-y-8'>
        {/* Main Heading */}
        <div className='text-center'>
          <h1 className='text-foreground text-3xl font-bold'>이용약관</h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            시행일: {formatAbsoluteDateKo(TERMS_EFFECTIVE_DATE)}
          </p>
        </div>

        {/* 제1조 목적 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제1조 (목적)</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            본 약관은 주식회사 웨이크(이하 &ldquo;회사&rdquo;)가 제공하는 사내 업무 지원 시스템
            WakeOne(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자 간의 권리·의무 및
            책임사항, 서비스 이용 조건과 절차 등 기본적인 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        {/* 제2조 정의 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제2조 (용어의 정의)</h2>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>
              <span className='text-foreground font-medium'>서비스</span>: 회사가 임직원의 업무
              수행을 지원하기 위해 운영하는 WakeOne 웹 애플리케이션 및 이에 부수하는 일체의 기능을
              말합니다.
            </li>
            <li>
              <span className='text-foreground font-medium'>이용자</span>: 회사로부터 계정을
              발급받아 서비스를 이용하는 임직원 및 회사가 이용을 승인한 자를 말합니다.
            </li>
            <li>
              <span className='text-foreground font-medium'>계정</span>: 이용자를 식별하고 서비스를
              이용할 수 있도록 회사가 발급한 이메일 기반의 로그인 수단을 말합니다.
            </li>
            <li>
              <span className='text-foreground font-medium'>관리자</span>: 회사로부터 관리자 권한을
              부여받아 계정 관리, 데이터 조회·수정 등 운영 업무를 수행하는 이용자를 말합니다.
            </li>
            <li>
              <span className='text-foreground font-medium'>업무 데이터</span>: 이용자가 서비스에
              등록·업로드하거나 서비스 이용 과정에서 생성된 계약 문서, 첨부파일, 기록 등 업무 관련
              일체의 정보를 말합니다.
            </li>
          </ul>
        </section>

        {/* 제3조 약관의 효력 및 변경 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            제3조 (약관의 효력 및 변경)
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 관련 법령을 위반하지 않는
            범위에서 본 약관을 변경할 수 있으며, 변경 시 적용일자와 변경사유를 명시하여 적용일 7일
            전부터 서비스 내 공지 또는 이메일 등으로 안내합니다. 이용자에게 불리한 변경의 경우 30일
            전부터 안내합니다. 이용자가 변경된 약관의 적용일 이후에도 서비스를 계속 이용하는 경우
            변경된 약관에 동의한 것으로 봅니다.
          </p>
        </section>

        {/* 제4조 계정의 발급 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제4조 (계정의 발급)</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            서비스는 일반 공개 서비스가 아니며, 이용자가 직접 가입 신청을 할 수 없습니다. 계정은
            인사 담당 부서 등 관리자가 신규 입사자 등 이용 대상자를 확인한 후 사용자 관리 화면에서
            직접 생성합니다. 이용자는 관리자로부터 안내받은 계정 정보로 최초 로그인한 뒤 즉시
            비밀번호를 변경하여야 합니다. 계정 생성에 필요한 정보는 회사가 보유한 인사 정보를
            기준으로 등록되며, 정보가 변경된 경우 이용자는 지체 없이 이를 수정하거나 관리자에게
            알려야 합니다.
          </p>
        </section>

        {/* 제5조 계정 관리 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            제5조 (계정 관리 및 이용자의 의무)
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            이용자는 자신의 계정과 비밀번호를 직접 관리할 책임이 있으며, 이를 제3자에게 양도·대여
            하거나 공유할 수 없습니다. 계정의 도용, 무단 사용 등 이상 징후를 인지한 경우 이용자는
            즉시 회사에 통지하고 회사의 안내에 따라야 합니다. 이용자의 관리 소홀로 발생한 결과에
            대하여 회사는 책임을 지지 않습니다.
          </p>
        </section>

        {/* 제6조 서비스의 내용 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제6조 (서비스의 내용)</h2>
          <p className='text-muted-foreground mb-3 text-base leading-relaxed'>
            회사가 제공하는 서비스의 주요 기능은 다음과 같으며, 회사는 운영상 필요에 따라 기능을
            추가·변경할 수 있습니다.
          </p>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>임직원 계정 및 프로필(소속, 직급, 연락처 등) 관리</li>
            <li>계약 문서의 조회·등록·수정 및 첨부파일 관리, 첨부 누락 안내 메일 발송</li>
            <li>법인카드 등 한도 정보의 동기화 및 조회</li>
            <li>생일자 안내 등 사내 운영 지원 기능</li>
            <li>알림, 활동 로그, 시스템 메일 발송 이력 조회</li>
          </ul>
        </section>

        {/* 제7조 서비스의 제공 및 중단 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            제7조 (서비스의 제공 및 중단)
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            서비스는 연중무휴 24시간 제공함을 원칙으로 합니다. 다만 회사는 시스템 점검, 설비의
            보수·교체, 서비스 개편, 통신 두절, 외부 연동 서비스의 장애 등 운영상 또는 기술상 필요한
            경우 서비스의 전부 또는 일부를 일시적으로 중단할 수 있습니다. 이 경우 회사는 사전에
            공지함을 원칙으로 하되, 사전 공지가 불가능한 부득이한 사유가 있는 경우 사후에 통지할 수
            있습니다.
          </p>
        </section>

        {/* 제8조 업무 데이터의 귀속 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제8조 (업무 데이터의 귀속)</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            서비스에 등록·생성된 업무 데이터는 회사의 업무 수행 과정에서 작성된 자료로서 회사에
            귀속됩니다. 이용자는 업무 목적 범위 내에서만 업무 데이터를 이용할 수 있으며, 회사의 사전
            승인 없이 이를 외부에 반출·공개하거나 개인적인 용도로 사용할 수 없습니다. 회사는 법령상
            보존 의무 및 내부 관리 기준에 따라 업무 데이터를 보관·관리합니다.
          </p>
        </section>

        {/* 제9조 금지행위 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제9조 (금지행위)</h2>
          <p className='text-muted-foreground mb-3 text-base leading-relaxed'>
            이용자는 서비스 이용과 관련하여 다음 각 호의 행위를 하여서는 안 됩니다.
          </p>
          <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-base leading-relaxed'>
            <li>타인의 계정을 무단으로 사용하거나 자신의 계정을 타인에게 이용하게 하는 행위</li>
            <li>부여받은 권한을 넘어 데이터에 접근하거나 접근 권한을 우회·조작하는 행위</li>
            <li>허위 정보를 등록하거나 업무 데이터를 임의로 위조·변조·훼손하는 행위</li>
            <li>업무와 무관한 목적으로 임직원의 개인정보를 조회·수집·유출하는 행위</li>
            <li>
              자동화된 수단으로 서비스에 과도한 부하를 유발하거나 서비스의 정상적인 운영을 방해하는
              행위
            </li>
            <li>회사의 지식재산권 또는 제3자의 권리를 침해하는 행위, 기타 법령을 위반하는 행위</li>
          </ul>
        </section>

        {/* 제10조 이용 제한 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            제10조 (이용 제한 및 계정 비활성화)
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 이용자가 본 약관을 위반하거나 서비스의 정상적인 운영을 방해한 경우 사전 통지 후
            서비스 이용을 제한하거나 계정을 비활성화할 수 있습니다. 다만 긴급한 조치가 필요한
            경우에는 선조치 후 통지할 수 있습니다. 또한 이용자가 퇴직·전출 등으로 이용 자격을 상실한
            경우 회사는 해당 계정을 비활성화하고 접근 권한을 회수합니다.
          </p>
        </section>

        {/* 제11조 개인정보의 보호 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제11조 (개인정보의 보호)</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 관련 법령에 따라 이용자의 개인정보를 보호하기 위하여 노력합니다. 개인정보의 수집
            항목, 이용 목적, 보유 기간, 처리위탁 등 구체적인 사항은{' '}
            <a href='/privacy-policy' className='text-primary font-medium hover:underline'>
              개인정보처리방침
            </a>
            에서 정한 바에 따릅니다.
          </p>
        </section>

        {/* 제12조 책임의 제한 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제12조 (책임의 제한)</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            회사는 천재지변, 정전, 통신망 장애, 클라우드·메일 등 외부 연동 서비스의 장애 등 회사의
            합리적인 통제를 벗어난 사유로 서비스를 제공할 수 없는 경우 그로 인한 책임을 지지
            않습니다. 또한 회사는 이용자의 귀책사유로 발생한 서비스 이용 장애, 이용자가 등록한 정보의
            정확성·신뢰성 부족으로 발생한 손해에 대하여 책임을 지지 않습니다. 다만 회사의 고의 또는
            중대한 과실로 인한 손해에 대해서는 그러하지 아니합니다.
          </p>
        </section>

        {/* 제13조 지식재산권 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>제13조 (지식재산권)</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            서비스를 구성하는 소프트웨어, 디자인, 상표, 문서 등 일체의 저작물에 대한 지식재산권은
            회사 또는 정당한 권리자에게 귀속됩니다. 이용자는 회사의 사전 서면 동의 없이 이를 복제,
            배포, 전송, 출판, 2차적 저작물 작성 등의 방법으로 이용할 수 없습니다.
          </p>
        </section>

        {/* 제14조 준거법 및 분쟁 해결 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>
            제14조 (준거법 및 분쟁 해결)
          </h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            본 약관은 대한민국 법령에 따라 규율되고 해석됩니다. 서비스 이용과 관련하여 회사와 이용자
            사이에 분쟁이 발생한 경우 양 당사자는 원만한 해결을 위하여 성실히 협의하며, 협의가
            이루어지지 않을 경우 민사소송법상의 관할 법원에 소를 제기할 수 있습니다.
          </p>
        </section>

        {/* 부칙 */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>부칙</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            본 약관은 {formatAbsoluteDateKo(TERMS_EFFECTIVE_DATE)}부터 시행합니다.
          </p>
        </section>

        {/* Contact */}
        <section className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-center text-sm'>
            본 약관에 대한 문의는{' '}
            <a href='mailto:info@wakecorp.com' className='text-primary font-medium hover:underline'>
              info@wakecorp.com
            </a>
            으로 연락해 주시기 바랍니다.
          </p>
        </section>
      </div>
    </div>
  );
}
