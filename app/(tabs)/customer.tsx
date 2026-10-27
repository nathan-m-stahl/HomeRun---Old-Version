import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

export default function CustomerScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  const hasAtLeastSevenCharacters = password.length >= 7;
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password === passwordConfirmation && password.length > 0;

  

  const [missingFields, setMissingFields] = useState<string[]>([]);

  function isMissing(fieldName: string) {
    return missingFields.includes(fieldName);
  }

  function clearMissingField(fieldName: string) {
    setMissingFields((currentFields) =>
      currentFields.filter((field) => field !== fieldName)
    );
  }

  const handleCustomerSignUp = async () => {
    if (!fullName || !email || !password || !passwordConfirmation) {
      Alert.alert("Missing Information", "Please fill out all fields.");
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert("Password Error", "Passwords do not match.");
      return;
    }

    if (password.length < 7) {
      Alert.alert("Password Error", "Password must be at least 7 characters.");
      return;
    }

    const hasNumber = /\d/.test(password);
    const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

    if (!hasNumber || !hasSpecialCharacter) {
      Alert.alert(
        "Password Error",
        "Password must include at least one number and one special character."
      );
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert("Sign Up Error", error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      Alert.alert(
        "Check Your Email",
        "Please confirm your email before logging in."
      );
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      email,
      role: "customer",
    });

    if (profileError) {
      Alert.alert("Profile Error", profileError.message);
      return;
    }

    const { error: customerProfileError } = await supabase
      .from("customer_profiles")
      .insert({
        id: user.id,
        phone: phoneNumber,
        address,
        notes: customerNote,
      });

    if (customerProfileError) {
      Alert.alert("Customer Profile Error", customerProfileError.message);
      return;
    }

    Alert.alert("Account Created", "Your customer account has been created.");
    router.replace("/customer-home");
  };

//   function handleSaveCustomerProfile() {
//     const missing = [];

//     if (!fullName) missing.push("fullName");
//     if (!password) missing.push("password");
//     if (!passwordConfirmation) missing.push("passwordConfirmation");
//     if (!phoneNumber) missing.push("phoneNumber");
//     if (!email) missing.push("email");
//     if (!address) missing.push("address");

//     setMissingFields(missing);

//     if (missing.length > 0) {
//       const fieldNames: Record<string, string> = {
//         fullName: "Full Name",
//         password: "Password",
//         passwordConfirmation: "Password Confirmation",
//         phoneNumber: "Phone Number",
//         email: "Email",
//         address: "Address",
//       };

//       Alert.alert(
//         "Missing Required Fields",
//         `Please complete the following:\n\n${missing
//           .map((field) => fieldNames[field])
//           .join("\n")}`
//       );

//       return;
//     }

//     if (!isPasswordValid) {
//       Alert.alert(
//         "Weak Password",
//         "Your password must be at least 7 characters and include one number and one special character."
//       );
//       return;
//     }

//     if (!passwordsMatch) {
//       Alert.alert("Password Mismatch", "Please make sure your passwords match.");
//       return;
//     }

//     const customerProfile = {
//       fullName,
//       phoneNumber,
//       address,
//       customerNote,
//     };

//     console.log("Customer Profile:", customerProfile);

//     Alert.alert("Account Created", "Your customer account was created.", [
//   {
//     text: "Continue",
//     onPress: () => router.push("/customer-home"),
//   },
// ]);
//   }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Create A Customer Account</Text>

      <Text style={styles.subtitle}>
        Set up your account so you can post tasks and hire local help around your home.
      </Text>

      <Text style={[styles.label, isMissing("fullName") && styles.labelError]}>
        Full Name
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: John Smith"
        placeholderTextColor="#999"
        value={fullName}
        onChangeText={(text) => {
          setFullName(text);
          clearMissingField("fullName");
        }}
      />

      <Text style={[styles.label, isMissing("password") && styles.labelError]}>
        Password
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Create a password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          clearMissingField("password");
        }}
        secureTextEntry
      />

      <Text style={[styles.passwordRule, hasAtLeastSevenCharacters && styles.passwordRuleValid]}>
        {hasAtLeastSevenCharacters ? "✓" : "○"} At least 7 characters
      </Text>

      <Text style={[styles.passwordRule, hasNumber && styles.passwordRuleValid]}>
        {hasNumber ? "✓" : "○"} At least 1 number
      </Text>

      <Text style={[styles.passwordRule, hasSpecialCharacter && styles.passwordRuleValid]}>
        {hasSpecialCharacter ? "✓" : "○"} At least 1 special character
      </Text>

      <Text style={[styles.label, isMissing("passwordConfirmation") && styles.labelError]}>
        Password Confirmation
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Re-enter your password"
        placeholderTextColor="#999"
        value={passwordConfirmation}
        onChangeText={(text) => {
          setPasswordConfirmation(text);
          clearMissingField("passwordConfirmation");
        }}
        secureTextEntry
      />

      {passwordConfirmation.length > 0 && (
        <Text
          style={[
            styles.passwordRule,
            passwordsMatch && styles.passwordRuleValid,
            !passwordsMatch && styles.passwordRuleInvalid,
          ]}
        >
          {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
        </Text>
      )}

      <Text style={[styles.label, isMissing("phoneNumber") && styles.labelError]}>
        Phone Number
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 555-555-5555"
        placeholderTextColor="#999"
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text);
          clearMissingField("phoneNumber");
        }}
        keyboardType="phone-pad"
      />

      <Text style={[styles.label, isMissing("email") && styles.labelError]}>
        Email
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: nathan@email.com"
        placeholderTextColor="#999"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          clearMissingField("email");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={[styles.label, isMissing("address") && styles.labelError]}>
        Enter an Address
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 1234 Main St, Springfield, CO 80014"
        placeholderTextColor="#999"
        value={address}
        onChangeText={(text) => {
          setAddress(text);
          clearMissingField("address");
        }}
      />

      <Text style={styles.label}>Anything Workers Should Know?</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Example: I usually need help with yard work, moving, or seasonal tasks."
        placeholderTextColor="#999"
        value={customerNote}
        onChangeText={setCustomerNote}
        multiline
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleCustomerSignUp}
      >
        <Text style={styles.buttonText}>Create Customer Account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginLink}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.loginLinkText}>
          Already have an account? Log in
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#F7F7F7",
  },

  backButton: {
    marginTop: 20,
    marginBottom: 20,
  },

  backButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F7A4D",
  },

  title: {
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#1F7A4D",
  },

  subtitle: {
    fontSize: 17,
    textAlign: "center",
    color: "#555",
    lineHeight: 24,
    marginBottom: 30,
  },

  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
  },

  textArea: {
    height: 110,
    textAlignVertical: "top",
  },

  passwordRule: {
    fontSize: 14,
    color: "#777",
    marginBottom: 6,
  },

  passwordRuleValid: {
    color: "#1F7A4D",
    fontWeight: "600",
  },

  passwordRuleInvalid: {
    color: "#B91C1C",
    fontWeight: "600",
  },

  primaryButton: {
    backgroundColor: "#111",
    padding: 18,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 40,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

    loginLink: {
    marginTop: -20,
    marginBottom: 40,
    padding: 12,
  },

  loginLinkText: {
    color: "#1F7A4D",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  labelError: {
    color: "#B91C1C",
  },
});