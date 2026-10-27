import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const categoryOptions = [
  "Mowing",
  "Weed Wacking",
  "Weeding",
  "Raking",
  "Landscaping",
  "Tree Trimming",
  "Snow Shoveling",
  "Gardening",
  "Window Washing",
  "Power Washing",
  "Assembly",
  "Junk Removal",
  "General Labor",
  "Other",
];

const equipmentOptions = [
  "No equipment needed",
  "Mower",
  "Rake",
  "Shovel",
  "Truck",
  "Trailer",
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

export default function PostTaskScreen() {
  const router = useRouter();

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [otherCategory, setOtherCategory] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [otherEquipment, setOtherEquipment] = useState("");
  const [price, setPrice] = useState("");
  const [paymentType, setPaymentType] = useState<"flat" | "hourly" | "estimate">("flat");
  const [address, setAddress] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedAmPm, setSelectedAmPm] = useState("PM");

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(null);
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(null);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);


  const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const minutes = Array.from({ length: 60 }, (_, index) =>
    index.toString().padStart(2, "0")
  );

  const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const calendarYear = calendarDate.getFullYear();
const calendarMonth = calendarDate.getMonth();

const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);

const firstWeekday = firstDayOfMonth.getDay();
const daysInMonth = lastDayOfMonth.getDate();

const calendarDays = [
  ...Array(firstWeekday).fill(null),
  ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
];

function goToPreviousMonth() {
  setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
}

function goToNextMonth() {
  setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
}

function handleSelectCalendarDay(day: number) {
  const selectedDate = new Date(calendarYear, calendarMonth, day);

  const formattedDate = `${
    monthNames[selectedDate.getMonth()]
  } ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`;

  setPreferredDate(formattedDate);
  setMissingFields(missingFields.filter((field) => field !== "preferredDate"));
  setShowDatePicker(false);
}

function handleConfirmTime() {
  setPreferredTime(`${selectedHour}:${selectedMinute} ${selectedAmPm}`);
  setMissingFields(missingFields.filter((field) => field !== "preferredTime"));
  setShowTimePicker(false);
}

  function toggleEquipment(equipment: string) {
    clearMissingField("selectedEquipment");

    if (equipment === "No equipment needed") {
      setSelectedEquipment(["No equipment needed"]);
      setOtherEquipment("");
      clearMissingField("otherEquipment");
      return;
    }

    if (selectedEquipment.includes(equipment)) {
      setSelectedEquipment(
        selectedEquipment.filter((item) => item !== equipment)
      );

      if (equipment === "Other") {
        setOtherEquipment("");
        clearMissingField("otherEquipment");
      }

      return;
    }

    setSelectedEquipment([
      ...selectedEquipment.filter((item) => item !== "No equipment needed"),
      equipment,
    ]);
  }

  function isMissing(fieldName: string) {
      return missingFields.includes(fieldName);
  }

  function clearMissingField(fieldName: string) {
    setMissingFields((currentFields) =>
      currentFields.filter((field) => field !== fieldName)
    );
  }

  async function handleAddressChange(text: string) {
    setAddressQuery(text);
    setSelectedAddress("");
    setSelectedPlaceId("");
    setSelectedLatitude(null);
    setSelectedLongitude(null);

    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      Alert.alert("Google API Error", "Missing Google Maps API key.");
      return;
    }

    setLoadingAddressSuggestions(true);

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          },
          body: JSON.stringify({
            input: text,
            includedPrimaryTypes: ["street_address", "premise"],
            includedRegionCodes: ["us"],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.log("Autocomplete error:", result);
        Alert.alert("Address Error", "Could not load address suggestions.");
        setAddressSuggestions([]);
        setLoadingAddressSuggestions(false);
        return;
      }

      setAddressSuggestions(result.suggestions || []);
    } catch (error) {
      console.log("Autocomplete fetch error:", error);
      Alert.alert("Address Error", "Could not load address suggestions.");
      setAddressSuggestions([]);
    }

    setLoadingAddressSuggestions(false);
  }

  async function handleSelectAddress(suggestion: any) {
    const placePrediction = suggestion.placePrediction;

    if (!placePrediction?.placeId) {
      Alert.alert("Address Error", "This address could not be selected.");
      return;
    }

    const placeId = placePrediction.placeId;

    if (!GOOGLE_MAPS_API_KEY) {
      Alert.alert("Google API Error", "Missing Google Maps API key.");
      return;
    }

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?fields=id,formattedAddress,location`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.log("Place details error:", result);
        Alert.alert("Address Error", "Could not load address details.");
        return;
      }

      const formattedAddress =
        result.formattedAddress ||
        placePrediction.text?.text ||
        addressQuery;

      const latitude = result.location?.latitude;
      const longitude = result.location?.longitude;

      if (latitude === undefined || longitude === undefined) {
        Alert.alert("Address Error", "This address does not have coordinates.");
        return;
      }

      setAddressQuery(formattedAddress);
      setSelectedAddress(formattedAddress);
      setSelectedPlaceId(result.id || placeId);
      setSelectedLatitude(latitude);
      setSelectedLongitude(longitude);
      setAddressSuggestions([]);
    } catch (error) {
      console.log("Place details fetch error:", error);
      Alert.alert("Address Error", "Could not load address details.");
    }
  }

  async function handlePostTask() {
    const missing = [];

    if (!taskTitle) missing.push("taskTitle");
    if (!taskDescription) missing.push("taskDescription");
    if (!selectedCategory) missing.push("selectedCategory");

    if (selectedCategory === "Other" && !otherCategory) {
      missing.push("otherCategory");
    }

    if (selectedEquipment.length === 0) {
      missing.push("selectedEquipment");
    }

    if (selectedEquipment.includes("Other") && !otherEquipment) {
      missing.push("otherEquipment");
    }

    if (paymentType !== "estimate" && !price) {
      missing.push("price");
    }

    if (!selectedAddress || selectedLatitude === null || selectedLongitude === null) {
      Alert.alert(
        "Address Required",
        "Please choose an address from the suggestions before posting your task."
      );
      return;
    }
    if (!preferredDate) missing.push("preferredDate");
    if (!preferredTime) missing.push("preferredTime");

    setMissingFields(missing);

    if (missing.length > 0) {
      const fieldNames: Record<string, string> = {
        taskTitle: "Task Title",
        taskDescription: "Task Description",
        selectedCategory: "Category",
        otherCategory: "Other Category",
        selectedEquipment: "Equipment Needed",
        otherEquipment: "Other Equipment",
        price: paymentType === "hourly" ? "Hourly Rate" : "Flat Rate Offer",
        address: "Task Address",
        preferredDate: "Preferred Date",
        preferredTime: "Preferred Time",
      };

      Alert.alert(
        "Missing Required Fields",
        `Please complete the following:\n\n${missing
          .map((field) => fieldNames[field])
          .join("\n")}`
      );

      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    

    const user = userData.user;

    if (!user) {
      Alert.alert("Not signed in", "Please sign in before posting a task.");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      customer_id: user.id,
      title: taskTitle,
      description: taskDescription,
      category: selectedCategory === "Other" ? otherCategory : selectedCategory,
      equipment_needed: selectedEquipment,
      payment_type: paymentType,
      price: paymentType === "estimate" ? null : Number(price),
      address: selectedAddress,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      extra_notes: extraNotes,
      status: "open",
    });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Task Posted", "Your task has been posted successfully.", [
      {
        text: "Back to Home",
        onPress: () => router.push("/customer-home"),
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/customer-home")}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Post a New Task</Text>

        <Text style={styles.subtitle}>
          Tell workers what you need done, when you need it, and what equipment
          they should bring.
        </Text>

        <Text style={[styles.label, isMissing("taskTitle") && styles.labelError]}>
            Task Title
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Mow front and backyard"
          placeholderTextColor="#999"
          value={taskTitle}
          onChangeText={(text) => {
          setTaskTitle(text);
          setMissingFields(missingFields.filter((field) => field !== "taskTitle"));
          }}
        />

        <Text style={[styles.label, isMissing("taskDescription") && styles.labelError]}>
            Task Description
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Example: I need my front and backyard mowed. Medium-sized yard, grass is a little tall."
          placeholderTextColor="#999"
          value={taskDescription}
          onChangeText={(text) => {
            setTaskDescription(text);
            setMissingFields(missingFields.filter((field) => field !== "taskDescription"));
          }}
          multiline
        />

        <Text style={[styles.label, isMissing("selectedCategory") && styles.labelError]}>
            Category
        </Text>
        <Text style={styles.helperText}>Choose the best match for this job.</Text>

        <View style={styles.chipContainer}>
          {categoryOptions.map((category) => {
            const isSelected = selectedCategory === category;

            return (
              <TouchableOpacity
                key={category}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => {
                setSelectedCategory(category);
                setMissingFields(missingFields.filter((field) => field !== "selectedCategory")
                );
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedCategory === "Other" && (
        <>
            <Text style={[styles.label, isMissing("otherCategory") && styles.labelError]}>
                Other Category
            </Text>
            <TextInput
            style={styles.input}
            placeholder="Example: Window washing, gutter cleaning, pet waste cleanup"
            placeholderTextColor="#999"
            value={otherCategory}
            onChangeText={(text) => {
              setOtherCategory(text);
              setMissingFields(missingFields.filter((field) => field !== "otherCategory"));
            }}
            />
        </>
        )}

        <Text
          style={[
            styles.label,
            isMissing("selectedEquipment") && styles.labelError,
          ]}
        >
          Equipment Worker Should Bring
        </Text>
        <Text style={styles.helperText}>
          Choose anything the worker needs to provide.
        </Text>

        <View style={styles.chipContainer}>
          {equipmentOptions.map((equipment) => {
            const isSelected = selectedEquipment.includes(equipment);

            return (
              <TouchableOpacity
                key={equipment}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleEquipment(equipment)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
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
            <Text style={[styles.label, isMissing("otherEquipment") && styles.labelError,]}
            >
            Other Equipment
          </Text>
            <TextInput
              style={styles.input}
              placeholder="Example: Hedge trimmer, chainsaw, shop vac"
              placeholderTextColor="#999"
              value={otherEquipment}
              onChangeText={(text) => {
                setOtherEquipment(text);
                clearMissingField("otherEquipment");
              }}
            />
          </>
        )}

        <Text style={styles.label}>Payment Type</Text>
        <Text style={styles.helperText}>Choose how you want this job to be paid.</Text>

        <View style={styles.paymentTypeRow}>
        <TouchableOpacity
          style={[
            styles.paymentTypeButton,
            paymentType === "flat" && styles.paymentTypeButtonSelected,
          ]}
          onPress={() => setPaymentType("flat")}
        >
          <Text
            style={[
              styles.paymentTypeText,
              paymentType === "flat" && styles.paymentTypeTextSelected,
            ]}
          >
            Flat Rate
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentTypeButton,
            paymentType === "hourly" && styles.paymentTypeButtonSelected,
          ]}
          onPress={() => setPaymentType("hourly")}
        >
          <Text
            style={[
              styles.paymentTypeText,
              paymentType === "hourly" && styles.paymentTypeTextSelected,
            ]}
          >
            Hourly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentTypeButton,
            paymentType === "estimate" && styles.paymentTypeButtonSelected,
          ]}
          onPress={() => {
            setPaymentType("estimate");
            setPrice("");
            clearMissingField("price");
          }}
        >
          <Text
            style={[
              styles.paymentTypeText,
              paymentType === "estimate" && styles.paymentTypeTextSelected,
            ]}
          >
            Estimate
          </Text>
        </TouchableOpacity>
      </View>

        {paymentType !== "estimate" && (
        <>
          <Text style={[styles.label, isMissing("price") && styles.labelError]}>
            {paymentType === "flat" ? "Flat Rate Offer ($)" : "Hourly Rate ($/hr)"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={paymentType === "flat" ? "Example: 50" : "Example: 20"}
            placeholderTextColor="#999"
            value={price}
            onChangeText={(text) => {
              setPrice(text);
              clearMissingField("price");
            }}
            keyboardType="numeric"
          />
        </>
      )}

        {paymentType === "hourly" && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How hourly jobs will work</Text>
            <Text style={styles.infoText}>
              The worker will be able to start and stop a timer during the job. After
              the job, you will review the logged hours before payment is released. If
              the worker forgets to track time, you can approve a manual payment amount.
            </Text>
          </View>
        )}

        {paymentType === "flat" && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How flat rate jobs will work</Text>
            <Text style={styles.infoText}>
              Best for jobs with a clear scope. You offer one total price, and the 
              worker is paid that amount after the job is completed and approved.
            </Text>
            </View>
        )}

        {paymentType === "estimate" && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Request an Estimate</Text>
            <Text style={styles.infoText}>
              Workers will review your task and send an estimated price before you accept
              them. This is best for jobs where the time or amount of work is unclear.
            </Text>
          </View>
        )}

        

        <Text style={styles.label}>Task Address</Text>

        <TextInput
          style={styles.input}
          placeholder="Start typing the task address"
          value={addressQuery}
          onChangeText={handleAddressChange}
        />

        {loadingAddressSuggestions ? (
          <Text style={styles.addressHelperText}>Loading address suggestions...</Text>
        ) : null}

        {addressSuggestions.length > 0 ? (
          <View style={styles.suggestionsContainer}>
            {addressSuggestions.map((suggestion, index) => {
              const prediction = suggestion.placePrediction;
              const mainText = prediction?.structuredFormat?.mainText?.text || "";
              const secondaryText =
                prediction?.structuredFormat?.secondaryText?.text || "";

              return (
                <TouchableOpacity
                  key={prediction?.placeId || index}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectAddress(suggestion)}
                >
                  <Text style={styles.suggestionMainText}>
                    {mainText || prediction?.text?.text}
                  </Text>

                  {secondaryText ? (
                    <Text style={styles.suggestionSecondaryText}>
                      {secondaryText}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {selectedLatitude !== null && selectedLongitude !== null ? (
          <Text style={styles.selectedAddressText}>
            Address selected ✓
          </Text>
        ) : null}

        <Text style={[styles.label, isMissing("preferredDate") && styles.labelError]}>
            Preferred Date
        </Text>

        <TouchableOpacity
        style={styles.selectorBox}
        onPress={() => setShowDatePicker(true)}
        >
        <Text
            style={[
            styles.selectorText,
            !preferredDate && styles.selectorPlaceholder,
            ]}
        >
            {preferredDate || "Select a date"}
        </Text>
        </TouchableOpacity>

        <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
        >
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
            <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={goToPreviousMonth}>
                <Text style={styles.calendarArrow}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.modalTitle}>
                {monthNames[calendarMonth]} {calendarYear}
                </Text>

                <TouchableOpacity onPress={goToNextMonth}>
                <Text style={styles.calendarArrow}>›</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.weekDayRow}>
                {weekDays.map((day) => (
                <Text key={day} style={styles.weekDayText}>
                    {day}
                </Text>
                ))}
            </View>

            <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                if (day === null) {
                    return <View key={`empty-${index}`} style={styles.calendarDay} />;
                }

                const selectedDateText = `${monthNames[calendarMonth]} ${day}, ${calendarYear}`;
                const isSelected = preferredDate === selectedDateText;

                return (
                    <TouchableOpacity
                    key={day}
                    style={[
                        styles.calendarDay,
                        isSelected && styles.calendarDaySelected,
                    ]}
                    onPress={() => handleSelectCalendarDay(day)}
                    >
                    <Text
                        style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                        ]}
                    >
                        {day}
                    </Text>
                    </TouchableOpacity>
                );
                })}
            </View>

            <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDatePicker(false)}
            >
                <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            </View>
        </View>
        </Modal>

        
        <Text style={[styles.label, isMissing("preferredTime") && styles.labelError]}>
            Preferred Time
        </Text>

        <TouchableOpacity
        style={styles.selectorBox}
        onPress={() => setShowTimePicker(true)}
        >
        <Text
            style={[
            styles.selectorText,
            !preferredTime && styles.selectorPlaceholder,
            ]}
        >
            {preferredTime || "Select a time"}
        </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Extra Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Example: Please park in the driveway. Gate is on the left side of the house."
          placeholderTextColor="#999"
          value={extraNotes}
          onChangeText={setExtraNotes}
          multiline
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            Workers nearby will be able to view your task and request it. You
            will eventually be able to review worker profiles, confirm the job,
            and pay upfront before work begins.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handlePostTask}>
          <Text style={styles.buttonText}>Post Task</Text>
        </TouchableOpacity>

            <Modal
            visible={showTimePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTimePicker(false)}
            >
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Select a Time</Text>

                <View style={styles.timePickerRow}>
                    <ScrollView style={styles.timeColumn}>
                    {hours.map((hour) => (
                        <TouchableOpacity
                        key={hour}
                        style={[
                            styles.timeOption,
                            selectedHour === hour && styles.timeOptionSelected,
                        ]}
                        onPress={() => setSelectedHour(hour)}
                        >
                        <Text
                            style={[
                            styles.timeOptionText,
                            selectedHour === hour && styles.timeOptionTextSelected,
                            ]}
                        >
                            {hour}
                        </Text>
                        </TouchableOpacity>
                    ))}
                    </ScrollView>

                    <ScrollView style={styles.timeColumn}>
                    {minutes.map((minute) => (
                        <TouchableOpacity
                        key={minute}
                        style={[
                            styles.timeOption,
                            selectedMinute === minute && styles.timeOptionSelected,
                        ]}
                        onPress={() => setSelectedMinute(minute)}
                        >
                        <Text
                            style={[
                            styles.timeOptionText,
                            selectedMinute === minute && styles.timeOptionTextSelected,
                            ]}
                        >
                            {minute}
                        </Text>
                        </TouchableOpacity>
                    ))}
                    </ScrollView>

                    <View style={styles.timeColumn}>
                    {["AM", "PM"].map((period) => (
                        <TouchableOpacity
                        key={period}
                        style={[
                            styles.timeOption,
                            selectedAmPm === period && styles.timeOptionSelected,
                        ]}
                        onPress={() => setSelectedAmPm(period)}
                        >
                        <Text
                            style={[
                            styles.timeOptionText,
                            selectedAmPm === period && styles.timeOptionTextSelected,
                            ]}
                        >
                            {period}
                        </Text>
                        </TouchableOpacity>
                    ))}
                    </View>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmTime}>
                    <Text style={styles.buttonText}>Confirm Time</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowTimePicker(false)}
                >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                </View>
            </View>
            </Modal>
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
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#1F7A4D",
  },

  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    lineHeight: 23,
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

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  chip: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 10,
  },

  chipSelected: {
    backgroundColor: "#1F7A4D",
    borderColor: "#1F7A4D",
  },

  chipText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },

  chipTextSelected: {
    color: "#FFF",
  },

  infoCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 18,
  },

  infoTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },

  infoText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
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

  selectorBox: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    },

    selectorText: {
    fontSize: 16,
    color: "#111",
    },

    selectorPlaceholder: {
    color: "#999",
    },

    modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: 24,
    },

    modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 20,
    },

    modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F7A4D",
    textAlign: "center",
    marginBottom: 18,
    },

    timePickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    },

    timeColumn: {
    width: "31%",
    maxHeight: 210,
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    padding: 6,
    },

    timeOption: {
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 6,
    },

    timeOptionSelected: {
    backgroundColor: "#1F7A4D",
    },

    timeOptionText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
    },

    timeOptionTextSelected: {
    color: "#FFF",
    },

    modalCancelButton: {
    padding: 12,
    },

    modalCancelText: {
    color: "#555",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    },

    calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    },

    calendarArrow: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#1F7A4D",
    paddingHorizontal: 12,
    },

    weekDayRow: {
    flexDirection: "row",
    marginBottom: 10,
    },

    weekDayText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    },

    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },

    calendarDay: {
    width: `${100 / 7}%`,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    },

    calendarDaySelected: {
    backgroundColor: "#1F7A4D",
    borderRadius: 999,
    },

    calendarDayText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
    },

    calendarDayTextSelected: {
        color: "#FFF",
    },

    labelError: {
        color: "#B91C1C",
    },

    paymentTypeRow: {
  flexDirection: "row",
  marginBottom: 18,
},

paymentTypeButton: {
  flex: 1,
  backgroundColor: "#FFF",
  borderWidth: 1,
  borderColor: "#DDD",
  padding: 14,
  borderRadius: 12,
  marginRight: 8,
},

paymentTypeButtonSelected: {
  backgroundColor: "#1F7A4D",
  borderColor: "#1F7A4D",
},

paymentTypeText: {
  color: "#111",
  fontSize: 15,
  fontWeight: "700",
  textAlign: "center",
},

paymentTypeTextSelected: {
  color: "#FFF",
},

addressHelperText: {
  fontSize: 13,
  color: "#777",
  marginTop: 6,
  marginBottom: 6,
},

suggestionsContainer: {
  backgroundColor: "#FFF",
  borderWidth: 1,
  borderColor: "#DDD",
  borderRadius: 10,
  marginTop: 6,
  marginBottom: 14,
  overflow: "hidden",
},

suggestionItem: {
  padding: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#EEE",
},

suggestionMainText: {
  fontSize: 15,
  fontWeight: "700",
  color: "#111",
},

suggestionSecondaryText: {
  fontSize: 13,
  color: "#666",
  marginTop: 3,
},

selectedAddressText: {
  fontSize: 13,
  color: "#1F7A4D",
  fontWeight: "700",
  marginTop: 6,
  marginBottom: 10,
},
});