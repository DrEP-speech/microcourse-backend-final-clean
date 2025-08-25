export default function SignupPage() {
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 24 }}>
      <h1>Sign up</h1>
      <form>
        <label>Email<br/><input type="email" name="email" required /></label><br/><br/>
        <label>Password<br/><input type="password" name="password" required /></label><br/><br/>
        <button type="submit">Create account</button>
      </form>
    </div>
  );
}
