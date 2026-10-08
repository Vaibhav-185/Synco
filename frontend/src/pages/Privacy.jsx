import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Privacy Policy</div>
          <div className="page-sub">Last updated: October 2026</div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">What Synco collects</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Account details you provide (display name, username, email, password hash),
          the class timetable you upload or enter, your friend and group connections,
          and your push notification subscription if you enable class alerts.
          Uploaded timetable photos are deleted from our servers after extraction
          and are never shared.
        </p>
      </div>
      <div className="card">
        <div className="card-title">How it is used</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Your data runs the product: showing your schedule, comparing free time
          with friends you approve, and sending class reminders you opt into.
          Timetable images are sent to our AI extraction provider to read the
          schedule grid. We do not sell personal data and we do not show ads.
        </p>
      </div>
      <div className="card">
        <div className="card-title">Sharing and control</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Friends see your timetable status only after you accept their request.
          Group members see overlapping free slots for groups you join. You can
          turn off notifications, remove friends, leave groups, or delete slots
          at any time. Contact the team to request export or deletion of your
          account data.
        </p>
      </div>
      <p style={{ fontSize: 12 }}>
        <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Back to Synco</Link>
      </p>
    </div>
  );
}
