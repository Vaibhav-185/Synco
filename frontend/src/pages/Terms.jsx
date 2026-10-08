import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Terms and Conditions</div>
          <div className="page-sub">Last updated: October 2026</div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Using Synco</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Synco helps students keep class timetables and find shared free time.
          Provide accurate information, keep your password private, and use the
          service for lawful, personal, non-commercial purposes. You must be
          old enough to consent to online services in your country.
        </p>
      </div>
      <div className="card">
        <div className="card-title">Acceptable use</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Do not abuse the service: no spam friend requests, no uploading
          images that are not timetables, no probing other users timetables
          without their approval, and no attempts to disrupt the service or
          exceed upload limits. AI extraction can misread a photo, so always
          review your timetable before relying on it.
        </p>
      </div>
      <div className="card">
        <div className="card-title">Availability and liability</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Synco is provided as is, without warranties. Class reminders depend
          on your browser notification settings and network, so they may not
          always arrive. We may suspend accounts that violate these terms and
          may change or discontinue features with notice.
        </p>
      </div>
      <p style={{ fontSize: 12 }}>
        <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Back to Synco</Link>
      </p>
    </div>
  );
}
