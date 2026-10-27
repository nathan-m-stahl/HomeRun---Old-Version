import { supabase } from "@/lib/supabase";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const skillOptions = [
  "Mowing",
  "Weeding",
  "Raking",
  "Snow Shoveling",
  "Moving Help",
  "Landscaping",
  "Painting",
  "Furniture Assembly",
  "Cleaning",
  "Junk Removal",
  "General Labor",
];

const equipmentOptions = [
  "None",
  "Mower",
  "Rake",
  "Shovel",
  "Truck",
  "Trailer",
  "Car",
  "Weed Whacker",
  "Leaf Blower",
  "Wheelbarrow",
  "Ladder",
  "Snow Blower",
  "Tool Set",
  "Power Washer",
  "Power Drill",
  "Other",
];

export default function WorkerScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [serviceRadius, setServiceRadius] = useState("");
  const [experience, setExperience] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [otherEquipment, setOtherEquipment] = useState("");
  const hasAtLeastSevenCharacters = password.length >= 7;
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password === passwordConfirmation && password.length > 0;

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const isPasswordValid =
    hasAtLeastSevenCharacters && hasNumber && hasSpecialCharacter;

  function toggleSkill(skill: string) {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((item) => item !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  }

  function toggleEquipment(equipment: string) {
    if (equipment === "None") {
      setSelectedEquipment(["None"]);
      return;
    }

    if (selectedEquipment.includes(equipment)) {
      setSelectedEquipment(selectedEquipment.filter((item) => item !== equipment));
    } else {
      setSelectedEquipment([
        ...selectedEquipment.filter((item) => item !== "None"),
        equipment,
      ]);
    }
  }

  function isMissing(fieldName: string) {
    return missingFields.includes(fieldName);
  }

  function clearMissingField(fieldName: string) {
    setMissingFields((currentFields) =>
      currentFields.filter((field) => field !== fieldName)
    );
  }

  async function askForWorkerLocationPermission() {
    Alert.alert(
      "Allow Location Access?",
      "HomeRun uses your location to show tasks near you within your service radius. Your live location is not saved to your profile.",
      [
        {
          text: "Not Now",
          style: "cancel",
          onPress: () => {
            Alert.alert(
              "Location Not Enabled",
              "You can still use HomeRun, but nearby tasks may not show correctly until location access is enabled."
            );

            router.replace("/worker-home");
          },
        },
        {
          text: "Allow",
          onPress: async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== "granted") {
              Alert.alert(
                "Location Not Enabled",
                "You can still use HomeRun, but nearby tasks may not show correctly until location access is enabled."
              );
            }

            router.replace("/worker-home");
          },
        },
      ]
    );
  }

  async function handleSaveProfile() {
    const missing = [];

    if (!fullName) missing.push("fullName");
    if (!password) missing.push("password");
    if (!passwordConfirmation) missing.push("passwordConfirmation");
    if (!phoneNumber) missing.push("phoneNumber");
    if (!email) missing.push("email");
    if (!address) missing.push("address");
    if (!age) missing.push("age");
    if (!bio) missing.push("bio");
    if (selectedSkills.length === 0) missing.push("selectedSkills");
    if (!serviceRadius) missing.push("serviceRadius");

    if (selectedEquipment.includes("Other") && !otherEquipment) {
      missing.push("otherEquipment");
    }

    setMissingFields(missing);

    if (missing.length > 0) {
      const fieldNames: Record<string, string> = {
        fullName: "Full Name",
        password: "Password",
        passwordConfirmation: "Password Confirmation",
        phoneNumber: "Phone Number",
        email: "Email",
        address: "Address",
        age: "Age",
        bio: "Short Bio",
        selectedSkills: "Skills",
        serviceRadius: "Service Radius",
        otherEquipment: "Other Equipment",
      };

      Alert.alert(
        "Missing Required Fields",
        `Please complete the following:\n\n${missing
          .map((field) => fieldNames[field])
          .join("\n")}`
      );

      return;
    }

    if (!isPasswordValid) {
      Alert.alert(
        "Weak Password",
        "Your password must be at least 7 characters and include one number and one special character."
      );
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert("Password Mismatch", "Please make sure your passwords match.");
      return;
    }

    const finalEquipment = selectedEquipment.map((item) =>
    item === "Other" ? otherEquipment : item
  );

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
    role: "worker",
  });

  if (profileError) {
    Alert.alert("Profile Error", profileError.message);
    return;
  }

  const { error: workerProfileError } = await supabase
    .from("worker_profiles")
    .insert({
      id: user.id,
      age: Number(age),
      bio,
      skills: selectedSkills,
      equipment: finalEquipment,
      service_radius_miles: Number(serviceRadius),
      phone: phoneNumber,
      address,
      experience,
    });

  if (workerProfileError) {
    Alert.alert("Worker Profile Error", workerProfileError.message);
    return;
  }

  Alert.alert("Profile Saved", "Your worker profile was created.", [
    {
      text: "Continue",
      onPress: askForWorkerLocationPermission,
    },
  ]);
  }

  return (
    <KeyboardAvoidingView
    style={styles.keyboardView}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
  >
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Sign Up To Become A Worker</Text>

      <Text style={styles.subtitle}>
        Create a profile so customers know who you are and what kind of work you
        can help with.
      </Text>

      <Text style={[styles.label, isMissing("fullName") && styles.labelError]}>
        Full Name
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: John Smith"
        placeholderTextColor="#bab5b5"
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
        placeholderTextColor="#bab5b5"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          clearMissingField("password");
        }}
        secureTextEntry
      />

      <View style={styles.passwordChecklist}>
        <Text
          style={[
            styles.passwordRule,
            hasAtLeastSevenCharacters && styles.passwordRuleValid,
          ]}
        >
          {hasAtLeastSevenCharacters ? "✓" : "○"} At least 7 characters
        </Text>

        <Text style={[styles.passwordRule, hasNumber && styles.passwordRuleValid]}>
          {hasNumber ? "✓" : "○"} At least 1 number
        </Text>

        <Text
          style={[
            styles.passwordRule,
            hasSpecialCharacter && styles.passwordRuleValid,
          ]}
        >
          {hasSpecialCharacter ? "✓" : "○"} At least 1 special character
        </Text>
      </View>

      <Text style={[styles.label, isMissing("passwordConfirmation") && styles.labelError]}>
        Password Confirmation
      </Text>
      <TextInput
        style={styles.input}
        value={passwordConfirmation}
        placeholder="Retype your password"
        placeholderTextColor="#bab5b5"
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

      <Text style={[styles.label, isMissing("age") && styles.labelError]}>
        Age
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 20"
        placeholderTextColor="#bab5b5"
        value={age}
        onChangeText={(text) => {
          setAge(text);
          clearMissingField("age");
        }}
        keyboardType="numeric"
        maxLength={3}
      />

      <Text style={[styles.label, isMissing("bio") && styles.labelError]}>
        Short Bio
      </Text>   
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Example: I can help with yard work, moving, and basic home tasks."
        placeholderTextColor="#bab5b5"
        value={bio}
        onChangeText={(text) => {
          setBio(text);
          clearMissingField("bio");
        }}
        multiline
      />

      <Text style={[styles.label, isMissing("selectedSkills") && styles.labelError]}>
        Skills
      </Text>
      <Text style={styles.helperText}>Choose all that apply.</Text>

      <View style={styles.skillContainer}>
        {skillOptions.map((skill) => {
          const isSelected = selectedSkills.includes(skill);

          return (
            <TouchableOpacity
              key={skill}
              style={[styles.skillChip, isSelected && styles.skillChipSelected]}
              onPress={() => {
                toggleSkill(skill);
                clearMissingField("selectedSkills");
              }}
            >
              <Text
                style={[
                  styles.skillChipText,
                  isSelected && styles.skillChipTextSelected,
                ]}
              >
                {skill}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, isMissing("serviceRadius") && styles.labelError]}>
        Service Radius (Miles)
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 10 "
        placeholderTextColor="#bab5b5"
        value={serviceRadius}
        onChangeText={(text) => {
          setServiceRadius(text);
          clearMissingField("serviceRadius");
        }}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Number of Years of Experience</Text>
      <TextInput
        style={styles.input}
        placeholder="Example: 1, 5, 10, etc."
        placeholderTextColor="#bab5b5"
        value={experience}
        onChangeText={setExperience}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Equipment</Text>
      <Text style={styles.helperText}>Choose all that apply.</Text>

      <View style={styles.skillContainer}>
        {equipmentOptions.map((equipment) => {
          const isSelected = selectedEquipment.includes(equipment);

          return (
            <TouchableOpacity
              key={equipment}
              style={[styles.skillChip, isSelected && styles.skillChipSelected]}
              onPress={() => toggleEquipment(equipment)}
            >
              <Text
                style={[
                  styles.skillChipText,
                  isSelected && styles.skillChipTextSelected,
                ]}
              >
                {equipment}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedEquipment.includes("Other") && (
        <>
          <Text style={styles.label}>Other Equipment</Text>
          <TextInput
            style={styles.input}
            placeholder="Example: Hedge trimmer, chainsaw, hand tools"
            placeholderTextColor="#bab5b5"
            value={otherEquipment}
            onChangeText={setOtherEquipment}
          />
        </>
      )}


      <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile}>
        <Text style={styles.buttonText}>Save Worker Profile</Text>
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
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 80,
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

  helperText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
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

  skillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  skillChip: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 10,
  },

  skillChipSelected: {
    backgroundColor: "#1F7A4D",
    borderColor: "#1F7A4D",
  },

  skillChipText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },

  skillChipTextSelected: {
    color: "#FFF",
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

  passwordChecklist: {
    marginTop: -8,
    marginBottom: 18,
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